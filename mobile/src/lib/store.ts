import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { loadPrefs } from './prefs';
import type { ClientMsg, Decision, Item, PermissionMode, ServerMsg, SessionState, SessionSummary, Usage } from '../../../shared/types';

export type Phase = 'boot' | 'connect' | 'unreachable' | 'setup' | 'login' | 'ready';
export type Conn = 'connecting' | 'online' | 'offline';

export interface Me {
  vapidPublicKey: string | null;
  defaultDir: string;
  home: string;
  host: string;
}

interface State {
  phase: Phase;
  server: string | null;
  host: string;
  conn: Conn;
  me: Me | null;
  usage: Usage;
  sessions: SessionSummary[] | null;
  current: SessionState | null;
  toast: string | null;
  /** App lock is covering the UI (see lock.ts). */
  locked: boolean;
}

let state: State = {
  phase: 'boot',
  server: null,
  host: '',
  conn: 'connecting',
  me: null,
  usage: {},
  sessions: null,
  current: null,
  toast: null,
  locked: false,
};
const listeners = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => sel(state),
  );
}
export const getState = () => state;

// A setup code that arrived with a scanned/pasted URL, consumed by the setup screen.
export let pendingSetupCode = '';
export const setPendingSetupCode = (c: string) => (pendingSetupCode = c);

// ── persisted connection ────────────────────────────────────────────────
const K_SERVER = 'server';
const K_TOKEN = 'token';
let token: string | null = null;

/** Accepts `my-mac.tail1234.ts.net`, `https://…/?setup=CODE`, `localhost:7878`, … */
export function parseServer(input: string): { url: string; code?: string } | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) {
    const local = /^(localhost|127\.|10\.|192\.168\.|100\.)/.test(s);
    s = (local ? 'http://' : 'https://') + s;
  }
  try {
    const u = new URL(s);
    const code = u.searchParams.get('setup')?.toUpperCase().replace(/[^A-Z0-9]/g, '') || undefined;
    return { url: `${u.protocol}//${u.host}`, code };
  } catch {
    return null;
  }
}

// ── http ────────────────────────────────────────────────────────────────
export class HttpError extends Error {
  constructor(public status: number, msg: string, public body?: any) {
    super(msg);
  }
}

export async function api<T = any>(path: string, init?: { method?: string; body?: unknown; server?: string; timeoutMs?: number }): Promise<T> {
  const base = init?.server ?? state.server;
  if (!base) throw new HttpError(0, 'No server');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init?.timeoutMs ?? 12_000);
  let res: Response;
  try {
    res = await fetch(base + path, {
      method: init?.method ?? (init?.body !== undefined ? 'POST' : 'GET'),
      headers: {
        ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: ctrl.signal,
    });
  } catch {
    if (state.phase === 'ready') set({ conn: 'offline' });
    throw new HttpError(0, 'Can’t reach your computer');
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => ({}));
  // A wrong app-lock PIN must never sign the phone out.
  if (res.status === 401 && state.phase === 'ready' && !path.startsWith('/api/login') && path !== '/api/verify-pin') {
    void signOut(false);
  }
  if (!res.ok) throw new HttpError(res.status, body?.error ?? `HTTP ${res.status}`, body);
  return body as T;
}

export function toast(msg: string) {
  set({ toast: msg });
  setTimeout(() => state.toast === msg && set({ toast: null }), 2600);
}

export function setLocked(locked: boolean) {
  set({ locked });
}

// ── lifecycle ───────────────────────────────────────────────────────────
// Lock on a cold start of an already signed-in app, but not right after a fresh sign-in.
let lockWhenReady = false;

function enterReady(patch: Partial<State> = {}) {
  set({ ...patch, phase: 'ready', locked: state.locked || lockWhenReady });
  lockWhenReady = false;
}

export async function boot() {
  const prefs = await loadPrefs();
  const server = await SecureStore.getItemAsync(K_SERVER);
  token = await SecureStore.getItemAsync(K_TOKEN);
  lockWhenReady = prefs.appLock && !!token;
  if (!server) return set({ phase: 'connect', server: null });
  set({ server });
  await check();
}

/** Ask the server where we stand and move to the right phase. */
export async function check(): Promise<void> {
  try {
    const st = await api<{ authed: boolean; needsSetup: boolean; host: string }>('/api/status', { timeoutMs: 8000 });
    set({ host: st.host });
    if (st.needsSetup) return set({ phase: 'setup' });
    if (!st.authed) return set({ phase: 'login' });
    await loadMe();
    enterReady();
    connect();
  } catch {
    // Signed in before? Show the app with an offline banner; otherwise a retry screen.
    if (token && state.me) enterReady({ conn: 'offline' });
    else set({ phase: 'unreachable' });
  }
}

/** Connect screen: verify the address answers like a Pocket Claude bridge, then remember it. */
export async function connectServer(url: string): Promise<{ host: string; needsSetup: boolean }> {
  const st = await api<{ needsSetup: boolean; host: string }>('/api/status', { server: url, timeoutMs: 8000 });
  if (typeof st?.needsSetup !== 'boolean') throw new HttpError(0, 'That address isn’t a Pocket Claude server');
  await SecureStore.setItemAsync(K_SERVER, url);
  token = null;
  await SecureStore.deleteItemAsync(K_TOKEN);
  set({ server: url, host: st.host, phase: st.needsSetup ? 'setup' : 'login' });
  return st;
}

export async function signIn(path: '/api/login' | '/api/setup', body: Record<string, unknown>) {
  const r = await api<{ token: string }>(path, { body: { ...body, client: 'native' } });
  token = r.token;
  await SecureStore.setItemAsync(K_TOKEN, r.token);
  await check();
}

export async function signOut(callServer = true) {
  if (callServer) await api('/api/logout', { body: {} }).catch(() => {});
  disconnect();
  token = null;
  await SecureStore.deleteItemAsync(K_TOKEN);
  set({ phase: 'login', sessions: null, current: null, me: null, locked: false });
}

export async function forgetServer() {
  await signOut(true);
  await SecureStore.deleteItemAsync(K_SERVER);
  set({ phase: 'connect', server: null, host: '' });
}

export async function loadMe() {
  const me = await api<Me & { usage: Usage }>('/api/me');
  set({ me, usage: me.usage ?? {} });
}

// ── websocket ───────────────────────────────────────────────────────────
let ws: WebSocket | null = null;
let backoff = 800;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let wanted = false;
let subscribed: string | null = null;
let foreground = AppState.currentState === 'active';

export function connect() {
  wanted = true;
  if (!state.server || !token) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  clearTimeout(retryTimer);
  if (state.conn !== 'offline') set({ conn: 'connecting' });
  const url = state.server.replace(/^http/, 'ws') + '/ws';
  // React Native's WebSocket accepts headers as a third argument.
  const sock = new (WebSocket as any)(url, null, { headers: { authorization: `Bearer ${token}` } }) as WebSocket;
  ws = sock;
  sock.onopen = () => {
    backoff = 800;
    set({ conn: 'online' });
    raw({ t: 'visibility', visible: foreground });
    raw({ t: 'subscribe', sessionId: subscribed });
    void refreshSessions();
  };
  sock.onmessage = (e) => handle(JSON.parse(String(e.data)));
  sock.onclose = () => {
    if (ws !== sock) return;
    ws = null;
    set({ conn: 'offline' });
    if (!wanted || !foreground) return;
    void api('/api/status').then((s) => { if (!s.authed) void signOut(false); }).catch(() => {});
    retryTimer = setTimeout(connect, backoff);
    backoff = Math.min(backoff * 1.7, 10_000);
  };
  sock.onerror = () => {};
}

export function disconnect() {
  wanted = false;
  clearTimeout(retryTimer);
  ws?.close();
  ws = null;
}

AppState.addEventListener('change', (s) => {
  foreground = s === 'active';
  raw({ t: 'visibility', visible: foreground });
  if (foreground && wanted && state.phase === 'ready') {
    backoff = 800;
    if (!ws || ws.readyState > 1) connect();
    void refreshSessions();
    if (subscribed) raw({ t: 'subscribe', sessionId: subscribed });
  }
});

function raw(m: ClientMsg) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(m));
    return true;
  }
  return false;
}
function send(m: ClientMsg) {
  if (!raw(m)) toast('Not connected to your computer');
}

export function subscribe(sessionId: string | null) {
  subscribed = sessionId;
  if (!sessionId || state.current?.sessionId !== sessionId) set({ current: null });
  raw({ t: 'subscribe', sessionId });
}

let refreshTimer: ReturnType<typeof setTimeout> | undefined;
export async function refreshSessions() {
  try {
    set({ sessions: await api<SessionSummary[]>('/api/sessions') });
  } catch {}
}

function handle(m: ServerMsg) {
  switch (m.t) {
    case 'state':
      if (m.state.sessionId === subscribed) set({ current: m.state });
      break;
    case 'item': {
      const cur = state.current;
      if (!cur || cur.sessionId !== m.sessionId) return;
      const i = cur.items.findIndex((x) => x.id === m.item.id);
      const items = i === -1 ? [...cur.items, m.item] : cur.items.map((x, j) => (j === i ? m.item : x));
      set({ current: { ...cur, items, lastModified: Date.now() } });
      if (m.item.kind === 'approval' && m.item.status === 'pending') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      break;
    }
    case 'status': {
      const cur = state.current;
      if (cur && cur.sessionId === m.sessionId) {
        set({ current: { ...cur, status: m.status, mode: m.mode, model: m.model ?? cur.model, live: m.status !== 'closed' && m.status !== 'error' ? true : cur.live } });
      }
      break;
    }
    case 'sessions_changed':
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(async () => {
        await refreshSessions();
        const cur = state.current;
        const me = state.sessions?.find((s) => s.sessionId === cur?.sessionId);
        if (cur?.live && me && !me.live) set({ current: { ...cur, live: false, status: 'closed' } });
      }, 250);
      break;
    case 'usage':
      set({ usage: m.usage });
      break;
    case 'error':
      toast(m.message);
      break;
  }
}

export const actions = {
  send: (sessionId: string, text: string) => send({ t: 'send', sessionId, text }),
  decide: (sessionId: string, approvalId: string, decision: Decision) => send({ t: 'decide', sessionId, approvalId, decision }),
  interrupt: (sessionId: string) => send({ t: 'interrupt', sessionId }),
  mode: (sessionId: string, mode: PermissionMode) => send({ t: 'mode', sessionId, mode }),
};

export function pendingApprovals(items: Item[]) {
  return items.filter((i): i is Extract<Item, { kind: 'approval' }> => i.kind === 'approval' && i.status === 'pending');
}
