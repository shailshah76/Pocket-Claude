import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';

const APP_CLI = '/Applications/Tailscale.app/Contents/MacOS/Tailscale';

export type TailscaleState =
  | { state: 'missing' }
  | { state: 'stopped' }
  | { state: 'needs-serve'; host: string; enableLink: string }
  | { state: 'ready'; host: string; url: string };

function run(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) =>
    execFile(bin, args, { timeout: 5000 }, (err, stdout) => (err ? reject(err) : resolve(stdout))),
  );
}

async function findCli(): Promise<string | null> {
  for (const bin of ['tailscale', '/usr/local/bin/tailscale', '/opt/homebrew/bin/tailscale', APP_CLI]) {
    if (bin.startsWith('/') && !existsSync(bin)) continue;
    try {
      await run(bin, ['version']);
      return bin;
    } catch {}
  }
  return null;
}

/** Where Tailscale is in being able to carry the phone to this bridge on `port`. Never prompts or waits. */
export async function tailscaleState(port: number): Promise<TailscaleState> {
  const bin = await findCli();
  if (!bin) return { state: 'missing' };
  let status: any;
  try {
    status = JSON.parse(await run(bin, ['status', '--json']));
  } catch {
    return { state: 'stopped' };
  }
  if (status.BackendState !== 'Running' || !status.Self) return { state: 'stopped' };
  const host = String(status.Self.DNSName ?? '').replace(/\.$/, '');
  let serve: any = {};
  try {
    serve = JSON.parse(await run(bin, ['serve', 'status', '--json']));
  } catch {}
  const proxiesUs = JSON.stringify(serve.Web ?? {}).includes(`127.0.0.1:${port}`) || JSON.stringify(serve.Web ?? {}).includes(`localhost:${port}`);
  if (!proxiesUs) {
    return { state: 'needs-serve', host, enableLink: `https://login.tailscale.com/f/serve?node=${encodeURIComponent(status.Self.ID ?? '')}` };
  }
  return { state: 'ready', host, url: `https://${host}` };
}
