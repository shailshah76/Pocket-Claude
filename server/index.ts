import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import { existsSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WebSocket } from 'ws';
import { loadConfig, saveConfig, type PushSub } from './config.js';
import { COOKIE, completeSetup, getSetupCode, login, needsSetup, parseCookie, revokeToken, verifyToken, type LoginResult } from './auth.js';
import { SessionHub, type Runtime } from './sessions.js';
import { FsError, list, readText, safePath } from './fs.js';
import { addSubscription, initPush, removeSubscription, sendPush } from './push.js';
import { isLocalBrowser, renderPairPage } from './pair.js';
import { tailscaleState } from './tailscale.js';
import type { ClientMsg, PermissionMode, ServerMsg } from '../shared/types.js';

const cfg = loadConfig();
const vapidPublicKey = initPush();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB_DIST = join(ROOT, 'web', 'dist');

// ── clients ───────────────────────────────────────────────────────────────
interface Client {
  ws: WebSocket;
  sessionId: string | null;
  visible: boolean;
}
const clients = new Set<Client>();

function send(c: Client, msg: ServerMsg) {
  if (c.ws.readyState === c.ws.OPEN) c.ws.send(JSON.stringify(msg));
}

const hub = new SessionHub({
  broadcast(sessionId, msg) {
    for (const c of clients) if (sessionId === null || c.sessionId === sessionId) send(c, msg);
  },
  notify(kind, rt: Runtime, body) {
    // Only buzz the phone when nobody is looking at the app.
    if ([...clients].some((c) => c.visible)) return;
    const where = basename(rt.cwd) || rt.cwd;
    const title = kind === 'approval' ? `Approval needed · ${where}` : kind === 'done' ? `Claude finished · ${where}` : `Claude stopped · ${where}`;
    void sendPush({ title, body: (body || rt.title).slice(0, 180), url: `/#/s/${rt.id}`, tag: `${rt.id}-${kind}` });
  },
});

// ── http ──────────────────────────────────────────────────────────────────
const app = Fastify({ logger: false, trustProxy: '127.0.0.1', bodyLimit: 1_000_000 });
await app.register(fastifyWebsocket);

const PUBLIC = new Set(['/api/login', '/api/status', '/api/setup']);
/** Web uses an HttpOnly cookie; the native app sends `Authorization: Bearer <token>`. */
function tokenOf(req: FastifyRequest): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return parseCookie(req.headers.cookie, COOKIE);
}
app.addHook('onRequest', async (req, reply) => {
  const path = req.url.split('?')[0];
  if (!(path.startsWith('/api/') || path === '/ws') || PUBLIC.has(path)) return;
  if (!verifyToken(tokenOf(req))) return reply.code(401).send({ error: 'unauthorized' });
});
app.addHook('onRequest', async (req, reply) => {
  const path = req.url.split('?')[0];
  if (!(path.startsWith('/api/') || path === '/ws')) return;
  if (req.method !== 'GET' || path === '/ws') {
    // Same-origin check: blocks cross-site form posts and WebSocket hijacking.
    const origin = req.headers.origin;
    const allowed = [req.headers.host, req.headers['x-forwarded-host']].flat().filter(Boolean);
    if (origin && !allowed.includes(new URL(origin).host)) return reply.code(403).send({ error: 'bad origin' });
  }
});

app.setErrorHandler((err: any, _req, reply) => {
  if (err instanceof FsError) return reply.code(err.status).send({ error: err.message });
  console.error(err);
  reply.code(err.statusCode ?? 500).send({ error: err.message ?? 'server error' });
});

app.get('/api/status', async (req) => ({
  authed: verifyToken(tokenOf(req)),
  needsSetup: needsSetup(),
  host: hostname().replace(/\.local$/, ''),
}));

function signIn(req: FastifyRequest, reply: FastifyReply, r: LoginResult, fallbackError: string) {
  if (!r.ok) return reply.code(r.retryAfterMs ? 429 : r.error === 'already set up' ? 409 : 401).send({ error: r.error ?? fallbackError, retryAfterMs: r.retryAfterMs });
  const secure = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https';
  // Native clients ask for the token in the body; browsers only ever get the HttpOnly cookie.
  if ((req.body as any)?.client === 'native') return { ok: true, token: r.token };
  reply.header(
    'set-cookie',
    `${COOKIE}=${r.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${30 * 86400}${secure ? '; Secure' : ''}`,
  );
  return { ok: true };
}
const deviceLabel = (req: FastifyRequest) => String(req.headers['user-agent'] ?? 'unknown').slice(0, 120);

app.post('/api/login', async (req: FastifyRequest<{ Body: { pin: string } }>, reply: FastifyReply) =>
  signIn(req, reply, login(String(req.body?.pin ?? ''), deviceLabel(req)), 'wrong pin'),
);

app.post('/api/setup', async (req: FastifyRequest<{ Body: { code: string; pin: string } }>, reply: FastifyReply) => {
  const r = completeSetup(String(req.body?.code ?? ''), String(req.body?.pin ?? ''), deviceLabel(req));
  if (r.ok) console.log('Setup complete. This phone is signed in.');
  return signIn(req, reply, r, 'setup failed');
});

app.post('/api/settings', async (req: FastifyRequest<{ Body: { defaultDir?: string } }>) => {
  if (req.body?.defaultDir !== undefined) {
    const dir = await safePath(req.body.defaultDir);
    const st = await list(dir, undefined, false); // throws if not a readable folder
    cfg.defaultDir = st.path;
    saveConfig();
  }
  return { defaultDir: cfg.defaultDir };
});

app.post('/api/logout', async (req, reply) => {
  revokeToken(tokenOf(req));
  reply.header('set-cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
  return { ok: true };
});

app.get('/api/me', async () => ({
  vapidPublicKey,
  defaultDir: cfg.defaultDir,
  home: homedir(),
  host: hostname().replace(/\.local$/, ''),
  usage: hub.usage,
}));

app.get('/api/sessions', async () => hub.list());

app.get('/api/sessions/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
  const st = await hub.state(req.params.id);
  return st ?? reply.code(404).send({ error: 'not found' });
});

app.post(
  '/api/sessions',
  async (req: FastifyRequest<{ Body: { cwd?: string; prompt?: string; resumeId?: string; fork?: boolean; mode?: PermissionMode } }>) => {
    const b = req.body ?? {};
    const cwd = await safePath(b.cwd || cfg.defaultDir);
    const rt = await hub.start({ cwd, prompt: b.prompt?.trim() || undefined, resumeId: b.resumeId, fork: !!b.fork, mode: b.mode });
    return { sessionId: rt.id };
  },
);

app.post('/api/sessions/:id/stop', async (req: FastifyRequest<{ Params: { id: string } }>) => {
  hub.live(req.params.id)?.close();
  return { ok: true };
});

app.get('/api/fs/list', async (req: FastifyRequest<{ Querystring: { path?: string; base?: string; hidden?: string } }>) =>
  list(req.query.path ?? '', req.query.base, req.query.hidden === '1'),
);

app.get('/api/fs/read', async (req: FastifyRequest<{ Querystring: { path: string } }>) => readText(req.query.path));

app.post('/api/push/subscribe', async (req: FastifyRequest<{ Body: any }>) => {
  addSubscription(req.body as PushSub);
  return { ok: true };
});
app.post('/api/push/unsubscribe', async (req: FastifyRequest<{ Body: { endpoint: string } }>) => {
  removeSubscription(req.body.endpoint);
  return { ok: true };
});
app.post('/api/push/test', async () => ({
  sent: await sendPush({ title: 'Pocket Claude', body: 'Notifications are working 🎉', url: '/', tag: 'test' }),
}));

// ── websocket ─────────────────────────────────────────────────────────────
app.get('/ws', { websocket: true }, (ws, req) => {
  const c: Client = { ws, sessionId: null, visible: true };
  clients.add(c);
  send(c, { t: 'usage', usage: hub.usage });
  const ping = setInterval(() => ws.ping(), 25_000);
  ws.on('close', () => {
    clearInterval(ping);
    clients.delete(c);
  });
  ws.on('message', async (raw) => {
    let m: ClientMsg;
    try {
      m = JSON.parse(String(raw));
    } catch {
      return;
    }
    try {
      switch (m.t) {
        case 'visibility':
          c.visible = !!m.visible;
          break;
        case 'subscribe': {
          c.sessionId = m.sessionId;
          if (m.sessionId) {
            const st = await hub.state(m.sessionId);
            if (st) send(c, { t: 'state', state: st });
            else send(c, { t: 'error', message: 'Session not found' });
          }
          break;
        }
        case 'send': {
          const text = String(m.text ?? '').trim();
          if (!text) break;
          const rt = hub.live(m.sessionId);
          if (rt) rt.send(text);
          else send(c, { t: 'error', message: 'Session is not running. Resume it first.' });
          break;
        }
        case 'decide':
          hub.live(m.sessionId)?.decide(m.approvalId, m.decision);
          break;
        case 'interrupt':
          await hub.live(m.sessionId)?.interrupt();
          break;
        case 'mode':
          if (['default', 'acceptEdits', 'plan'].includes(m.mode)) await hub.live(m.sessionId)?.setMode(m.mode);
          break;
      }
    } catch (e: any) {
      send(c, { t: 'error', message: String(e?.message ?? e) });
    }
  });
  void req;
});

// ── pairing page (this Mac's browser only) ────────────────────────────────
app.get('/pair', async (req, reply) => {
  if (!isLocalBrowser(req)) return reply.code(404).send('Not found');
  const html = await renderPairPage(await tailscaleState(cfg.port), getSetupCode(), hostname().replace(/\.local$/, ''));
  reply.header('cache-control', 'no-store').type('text/html').send(html);
});

// ── static PWA ────────────────────────────────────────────────────────────
if (existsSync(WEB_DIST)) {
  await app.register(fastifyStatic, {
    root: WEB_DIST,
    setHeaders(reply, path) {
      if (path.endsWith('sw.js') || path.endsWith('.html') || path.endsWith('.webmanifest')) reply.header("cache-control", "no-cache");
    },
  });
} else {
  app.get('/', async () => 'Web app not built. Run: npm run build');
}

const shutdown = () => {
  hub.closeAll();
  void app.close().then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ host: '127.0.0.1', port: cfg.port });
console.log(`Pocket Claude bridge listening on http://127.0.0.1:${cfg.port}`);
const code = getSetupCode();
if (code) {
  console.log(`\nFirst-time setup: open the app on your phone and enter this code:\n\n    ${code.slice(0, 4)}-${code.slice(4)}\n`);
  console.log(`Or open http://127.0.0.1:${cfg.port}/pair on this Mac for a QR code.`);
}
