import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DATA_DIR = process.env.POCKET_CLAUDE_HOME ?? join(homedir(), '.pocket-claude');
const CONFIG_FILE = join(DATA_DIR, 'config.json');

export interface StoredToken {
  hash: string;
  created: number;
  expires: number;
  label: string;
}

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface Config {
  port: number;
  /** Folder new sessions start in. */
  defaultDir: string;
  /** The phone may only browse / read files under these folders. */
  roots: string[];
  pin: { salt: string; hash: string } | null;
  vapid: { publicKey: string; privateKey: string; subject: string } | null;
  tokens: StoredToken[];
  pushSubs: PushSub[];
}

const defaults = (): Config => ({
  port: 7878,
  defaultDir: homedir(),
  roots: [homedir()],
  pin: null,
  vapid: null,
  tokens: [],
  pushSubs: [],
});

let cached: Config | null = null;

export function loadConfig(): Config {
  if (cached) return cached;
  mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  cached = existsSync(CONFIG_FILE)
    ? { ...defaults(), ...JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) }
    : defaults();
  return cached!;
}

export function saveConfig(): void {
  if (!cached) return;
  writeFileSync(CONFIG_FILE, JSON.stringify(cached, null, 2), { mode: 0o600 });
  chmodSync(CONFIG_FILE, 0o600);
}
