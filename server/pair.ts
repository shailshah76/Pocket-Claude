import type { FastifyRequest } from 'fastify';
import QRCode from 'qrcode';
import type { TailscaleState } from './tailscale.js';

/**
 * The pairing page shows the setup code, so it must only ever be served to a
 * browser on this Mac — never through `tailscale serve`, which also connects
 * from 127.0.0.1 but adds forwarding headers and a *.ts.net Host.
 */
export function isLocalBrowser(req: FastifyRequest): boolean {
  const ip = req.socket.remoteAddress ?? '';
  const host = String(req.headers.host ?? '').replace(/:\d+$/, '');
  const proxied = Object.keys(req.headers).some((h) => h.startsWith('x-forwarded-') || h.startsWith('tailscale-'));
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip) && ['127.0.0.1', 'localhost'].includes(host) && !proxied;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function renderPairPage(ts: TailscaleState, setupCode: string | null, hostName: string): Promise<string> {
  let body: string;
  let done = false;

  if (ts.state === 'missing') {
    body = step(
      'Install Tailscale on this Mac',
      'Tailscale privately connects your phone to this Mac from any Wi-Fi or mobile network.',
      `<a class="btn" href="https://tailscale.com/download/mac" target="_blank" rel="noreferrer">Download Tailscale</a>
       <p class="muted">Open it, sign in, and this page will update by itself.</p>`,
    );
  } else if (ts.state === 'stopped') {
    body = step(
      'Turn on Tailscale',
      'Tailscale is installed but not connected.',
      `<p>Click the Tailscale icon in the menu bar (top right of your screen) and choose <b>Log in</b> or <b>Connect</b>.</p>
       <p class="muted">This page will update by itself.</p>`,
    );
  } else if (ts.state === 'needs-serve') {
    body = step(
      'One click left: allow secure connections',
      `Tailscale needs your OK to make <code>${esc(ts.host)}</code> reachable from <b>your own</b> devices (never the public internet).`,
      `<a class="btn" href="${esc(ts.enableLink)}" target="_blank" rel="noreferrer">Enable in Tailscale</a>
       <p class="muted">Then keep the Terminal window with <code>npm run onboard</code> open; it finishes by itself. Not running it? Run <code>npm run onboard</code> again.</p>`,
    );
  } else {
    const target = setupCode ? `${ts.url}/?setup=${setupCode}` : ts.url;
    const svg = await QRCode.toString(target, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#141413', light: '#ffffff' } });
    done = !setupCode;
    body = `
      <div class="pair">
        <div class="qr" aria-label="QR code for ${esc(target)}">${svg}</div>
        <div class="how">
          <h2>${setupCode ? 'Scan this with your phone' : 'Add another phone'}</h2>
          <ol>
            <li>Install <b>Tailscale</b> on your phone and sign in with the <b>same account</b> as this Mac.</li>
            <li><b>Android app:</b> open Pocket Claude, tap <b>Scan QR code</b>.<br><b>iPhone:</b> point the Camera app at the code and tap the link.</li>
            <li>${setupCode ? 'Choose a PIN. That’s it.' : 'Sign in with your PIN.'}</li>
          </ol>
          ${setupCode ? `<div class="code"><span>Setup code</span><b>${setupCode.slice(0, 4)}-${setupCode.slice(4)}</b></div>` : '<div class="ok">✓ This Mac is set up. Phones sign in with your PIN.</div>'}
          <p class="muted">Or type this address in the app: <code>${esc(ts.host)}</code></p>
        </div>
      </div>`;
  }

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
${done ? '' : '<meta http-equiv="refresh" content="4">'}
<title>Connect your phone · Pocket Claude</title>
<link rel="icon" href="/icon-192.png">
<style>
  :root { --bg:#faf9f5; --card:#fff; --text:#1f1e1d; --muted:#6b6a65; --accent:#c96442; --border:rgba(0,0,0,.09); --soft:#f3f1ea; --ok:#2f9e5f; }
  @media (prefers-color-scheme: dark) { :root { --bg:#141413; --card:#1d1c1a; --text:#f2efe8; --muted:#a19e95; --accent:#d97757; --border:rgba(255,255,255,.09); --soft:#262522; --ok:#6cc28c; } }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:32px 16px; background:var(--bg); color:var(--text);
         font:16px/1.55 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
  main { width:100%; max-width:860px; }
  header { display:flex; align-items:center; gap:14px; margin-bottom:28px; }
  header img { width:48px; height:48px; border-radius:13px; }
  h1 { font:500 30px/1.15 "Iowan Old Style", Georgia, serif; margin:0; }
  header p { margin:2px 0 0; color:var(--muted); }
  .card { background:var(--card); border:1px solid var(--border); border-radius:24px; padding:32px; box-shadow:0 10px 40px rgba(0,0,0,.06); }
  h2 { font:500 23px/1.25 "Iowan Old Style", Georgia, serif; margin:0 0 10px; }
  .pair { display:grid; grid-template-columns:300px 1fr; gap:36px; align-items:center; }
  .qr { background:#fff; border-radius:18px; padding:10px; box-shadow:0 0 0 1px var(--border); }
  .qr svg { display:block; width:100%; height:auto; }
  ol { margin:0 0 18px; padding-left:20px; } li { margin:8px 0; }
  .code { display:inline-flex; flex-direction:column; gap:2px; background:var(--soft); border-radius:14px; padding:12px 18px; }
  .code span { font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); }
  .code b { font:700 30px ui-monospace, "SF Mono", Menlo, monospace; letter-spacing:.12em; }
  .ok { color:var(--ok); font-weight:600; }
  .btn { display:inline-block; background:var(--accent); color:#fff; text-decoration:none; font-weight:600; padding:13px 22px; border-radius:13px; margin:8px 0 4px; }
  .muted { color:var(--muted); font-size:14px; }
  code { font:13.5px ui-monospace, "SF Mono", Menlo, monospace; background:var(--soft); padding:2px 6px; border-radius:6px; }
  .live { margin-top:18px; font-size:13px; color:var(--muted); display:flex; align-items:center; gap:8px; }
  .live i { width:8px; height:8px; border-radius:50%; background:var(--accent); animation:p 1.4s infinite; }
  @keyframes p { 50% { opacity:.3 } }
  @media (max-width:700px) { .pair { grid-template-columns:1fr; } .qr { max-width:300px; } .card { padding:22px; } }
</style></head>
<body><main>
  <header><img src="/icon-192.png" alt=""><div><h1>Connect your phone</h1><p>Pocket Claude on ${esc(hostName)}</p></div></header>
  <div class="card">${body}</div>
  ${done ? '' : '<div class="live"><i></i> This page updates by itself.</div>'}
</main></body></html>`;
}

function step(title: string, intro: string, action: string): string {
  return `<h2>${title}</h2><p>${intro}</p>${action}`;
}
