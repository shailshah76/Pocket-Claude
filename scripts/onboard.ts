// One-command setup: checks prerequisites, builds, starts the bridge, exposes it
// over Tailscale, and prints a QR code that opens the phone app's setup screen.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import qrcode from 'qrcode-terminal';
import { loadConfig } from '../server/config.js';
import { SETUP_CODE_FILE } from '../server/auth.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = loadConfig();
const PORT = cfg.port;
const b = (s: string) => `\x1b[1m${s}\x1b[0m`;
const ok = (s: string) => console.log(`  \x1b[32m✓\x1b[0m ${s}`);
const warn = (s: string) => console.log(`  \x1b[33m!\x1b[0m ${s}`);
const bad = (s: string) => console.log(`  \x1b[31m✗\x1b[0m ${s}`);
const step = (s: string) => console.log(`\n${b(s)}`);

function run(cmd: string, args: string[], opts: { quiet?: boolean } = {}): { ok: boolean; out: string } {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: opts.quiet ? 'pipe' : 'inherit' });
  return { ok: r.status === 0, out: (r.stdout ?? '') + (r.stderr ?? '') };
}
function which(cmd: string): string | null {
  const r = spawnSync('/bin/sh', ['-c', `command -v ${cmd}`], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

console.log(b('\nPocket Claude — setup\n'));

// 1. prerequisites
step('1. Checking prerequisites');
const [major] = process.versions.node.split('.').map(Number);
if (major < 20) {
  bad(`Node ${process.versions.node} is too old — install Node 20 or newer.`);
  process.exit(1);
}
ok(`Node ${process.versions.node}`);

const claude = which('claude');
if (!claude) {
  bad('Claude Code is not installed. Install it: https://docs.claude.com/en/docs/claude-code/setup');
  process.exit(1);
}
try {
  const st = JSON.parse(execFileSync(claude, ['auth', 'status'], { encoding: 'utf8' }));
  if (!st.loggedIn) throw new Error();
  ok(`Claude Code signed in (${st.authMethod ?? 'ok'})`);
} catch {
  bad('Claude Code is not signed in. Run `claude` once and log in, then re-run `npm run onboard`.');
  process.exit(1);
}

// 2. build
step('2. Building the phone app');
if (!run('npm', ['run', 'build'], { quiet: true }).ok) {
  bad('Build failed — run `npm run build` to see the error.');
  process.exit(1);
}
ok('Built web/dist');

// 3. start the bridge
step('3. Starting the bridge');
const status = async () => {
  try {
    return (await (await fetch(`http://127.0.0.1:${PORT}/api/status`)).json()) as { needsSetup: boolean };
  } catch {
    return null;
  }
};
if (platform() === 'darwin') {
  run(join(ROOT, 'scripts/service.sh'), ['install'], { quiet: true });
  for (let i = 0; i < 40 && !(await status()); i++) await new Promise((r) => setTimeout(r, 250));
  if (await status()) ok(`Running as a login service on 127.0.0.1:${PORT} (restarts automatically)`);
  else {
    bad(`Bridge didn't start — check ~/.pocket-claude/bridge.log`);
    process.exit(1);
  }
} else if (await status()) {
  ok(`Already running on 127.0.0.1:${PORT}`);
} else {
  warn(`Start the bridge in another terminal with:  npm start   (then re-run npm run onboard)`);
  process.exit(1);
}

// 4. tailscale
step('4. Making it reachable from your phone (Tailscale)');
const tsBin = which('tailscale') ?? ['/Applications/Tailscale.app/Contents/MacOS/Tailscale'].find(existsSync) ?? null;
let url: string | null = null;
if (!tsBin) {
  warn('Tailscale is not installed. It connects your phone to this computer from any network — no domain or open ports.');
  console.log(`     • Computer: https://tailscale.com/download${platform() === 'darwin' ? '  (or: brew install --cask tailscale)' : ''}`);
  console.log('     • Phone: install "Tailscale" from the App Store / Play Store, same account');
  console.log('     Then re-run:  npm run onboard');
} else {
  const st = run(tsBin, ['status', '--json'], { quiet: true });
  let self: any = null;
  try {
    const j = JSON.parse(st.out);
    if (j.BackendState === 'Running') self = j.Self;
  } catch {}
  if (!self) {
    warn('Tailscale is installed but not connected. Open it and sign in, then re-run:  npm run onboard');
  } else {
    const serve = run(tsBin, ['serve', '--bg', String(PORT)], { quiet: true });
    const host = String(self.DNSName ?? '').replace(/\.$/, '');
    if (!serve.ok) {
      warn('`tailscale serve` failed:');
      console.log(serve.out.trim().split('\n').map((l) => '     ' + l).join('\n'));
      console.log('     Usually this means HTTPS certificates are off: enable MagicDNS + HTTPS at https://login.tailscale.com/admin/dns');
    } else if (host) {
      url = `https://${host}`;
      ok(`Serving on ${url} (only your Tailscale devices can reach it)`);
    }
  }
}

// 5. phone
step('5. Open it on your phone');
const s = await status();
const code = s?.needsSetup && existsSync(SETUP_CODE_FILE) ? readFileSync(SETUP_CODE_FILE, 'utf8').trim() : null;
if (url) {
  const target = code ? `${url}/?setup=${code}` : url;
  qrcode.generate(target, { small: true }, (q) => console.log(q.replace(/^/gm, '   ')));
  console.log(`   Scan with your phone camera, or open: ${b(target)}`);
}
if (code) {
  console.log(`\n   Setup code: ${b(`${code.slice(0, 4)}-${code.slice(4)}`)}  — you'll choose your PIN on the phone.`);
} else if (s && !s.needsSetup) {
  console.log('   Already set up — sign in with your PIN.');
}
console.log(`
   Then install it like an app:
     • Android (Chrome): tap "Install" in the app, or ⋮ → Install app
     • iPhone (Safari): Share → Add to Home Screen
   …and turn on notifications in ⚙ Settings.
`);
