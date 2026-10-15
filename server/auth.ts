import { randomBytes, randomInt, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR, loadConfig, saveConfig } from './config.js';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const COOKIE = 'pc_token';

export function hashPin(pin: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString('hex');
  return { salt, hash: scryptSync(pin, salt, 64).toString('hex') };
}

function checkPin(pin: string): boolean {
  const cfg = loadConfig();
  if (!cfg.pin) return false;
  const got = scryptSync(pin, cfg.pin.salt, 64);
  return timingSafeEqual(got, Buffer.from(cfg.pin.hash, 'hex'));
}

// Brute-force protection: exponential lockout after repeated failures, shared
// across all clients (there is only one user).
let failures = 0;
let lockedUntil = 0;

export type LoginResult = { ok: true; token: string } | { ok: false; retryAfterMs?: number; error?: string };

function fail(now: number): Extract<LoginResult, { ok: false }> {
  failures++;
  if (failures >= 5) lockedUntil = now + Math.min(2 ** (failures - 5), 60) * 60_000;
  return { ok: false, retryAfterMs: lockedUntil > now ? lockedUntil - now : undefined };
}

export function login(pin: string, label: string): LoginResult {
  const now = Date.now();
  if (now < lockedUntil) return { ok: false, retryAfterMs: lockedUntil - now };
  if (typeof pin !== 'string' || !checkPin(pin)) return fail(now);
  failures = 0;
  return { ok: true, token: issueToken(label) };
}

// ── first-run setup ───────────────────────────────────────────────────────
// Until a PIN exists, whoever presents this one-time code (shown only in the
// Mac's terminal) gets to choose it — so nobody else on the network can.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let setupCode: string | null = null;
export const SETUP_CODE_FILE = join(DATA_DIR, 'setup-code');

export function needsSetup(): boolean {
  return !loadConfig().pin;
}

export function getSetupCode(): string | null {
  if (!needsSetup()) return null;
  if (!setupCode) {
    setupCode = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    writeFileSync(SETUP_CODE_FILE, setupCode + '\n', { mode: 0o600 });
  }
  return setupCode;
}

export function completeSetup(code: string, pin: string, label: string): LoginResult {
  const now = Date.now();
  if (now < lockedUntil) return { ok: false, retryAfterMs: lockedUntil - now };
  const expected = getSetupCode();
  if (!expected) return { ok: false, error: 'already set up' };
  const got = Buffer.from(String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
  if (got.length !== expected.length || !timingSafeEqual(got, Buffer.from(expected))) return { ...fail(now), error: 'wrong setup code' };
  if (!/^\d{6,12}$/.test(pin)) return { ok: false, error: 'PIN must be 6–12 digits' };
  failures = 0;
  const cfg = loadConfig();
  cfg.pin = hashPin(pin);
  cfg.tokens = [];
  saveConfig();
  setupCode = null;
  rmSync(SETUP_CODE_FILE, { force: true });
  return { ok: true, token: issueToken(label) };
}

function issueToken(label: string): string {
  const now = Date.now();
  const token = randomBytes(32).toString('base64url');
  const cfg = loadConfig();
  cfg.tokens = cfg.tokens.filter((t) => t.expires > now);
  cfg.tokens.push({ hash: sha(token), created: now, expires: now + TOKEN_TTL_MS, label });
  saveConfig();
  return token;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const h = sha(token);
  return loadConfig().tokens.some((t) => t.hash === h && t.expires > Date.now());
}

export function revokeToken(token: string | undefined): void {
  if (!token) return;
  const cfg = loadConfig();
  const h = sha(token);
  cfg.tokens = cfg.tokens.filter((t) => t.hash !== h);
  saveConfig();
}

export function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

function sha(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}
