import { useSyncExternalStore } from 'react';
import type { ClientMsg, Decision, Item, PermissionMode, ServerMsg, SessionState, SessionSummary, Usage } from '../../shared/types';

export type Conn = 'connecting' | 'online' | 'offline';

export interface Me {
  vapidPublicKey: string | null;
  defaultDir: string;
  home: string;
  host: string;
}

interface State {
  conn: Conn;
  me: Me | null;
  usage: Usage;
  sessions: SessionSummary[] | null;
  current: SessionState | null;
  toast: string | null;
}

let state: State = { conn: 'connecting', me: null, usage: {}, sessions: null, current: null, toast: null };
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

// ── http ────────────────────────────────────────────────────────────────
export class HttpError extends Error {
  constructor(public status: number, msg: string, public body?: any) {
    super(msg);
  }
}

export async function api<T = any>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? (init?.body !== undefined ? 'POST' : 'GET'),
      headers: init?.body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    set({ conn: 'offline' });
    throw new HttpError(0, 'Can’t reach your Mac');
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/login') {
    authListener?.(false);
  }
  if (!res.ok) throw new HttpError(res.status, body?.error ?? res.statusText, body);
  return body as T;
}

let authListener: ((authed: boolean) => void) | null = null;
export const onAuthChange = (fn: (authed: boolean) => void) => (authListener = fn);

export function toast(msg: string) {
  set({ toast: msg });
  setTimeout(() => state.toast === msg && set({ toast: null }), 2600);
}

// ── websocket ───────────────────────────────────────────────────────────
let ws: WebSocket | null = null;
let backoff = 800;
let retryTimer: number | undefined;
let wanted = false;
let subscribed: string | null = null;

export function connect() {
  wanted = true;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  clearTimeout(retryTimer);
  if (state.conn !== 'offline') set({ conn: 'connecting' });
  const sock = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws = sock;
  sock.onopen = () => {
    backoff = 800;
    set({ conn: 'online' });
    sendRaw({ t: 'visibility', visible: document.visibilityState === 'visible' });
    sendRaw({ t: 'subscribe', sessionId: subscribed });
    void refreshSessions();
  };
  sock.onmessage = (e) => handle(JSON.parse(e.data));
  sock.onclose = () => {
    if (ws !== sock) return;
    ws = null;
    set({ conn: 'offline' });
    if (!wanted) return;
    // A 401 on the upgrade shows up only as a close; check auth over HTTP.
    void api('/api/status').then((s) => !s.authed && authListener?.(false)).catch(() => {});
    retryTimer = window.setTimeout(connect, backoff);
    backoff = Math.min(backoff * 1.7, 10_000);
  };
}

export function disconnect() {
  wanted = false;
  ws?.close();
  ws = null;
}

document.addEventListener('visibilitychange', () => {
  const visible = document.visibilityState === 'visible';
  if (visible && wanted && (!ws || ws.readyState > 1)) {
    backoff = 800;
    connect();
  }
  sendRaw({ t: 'visibility', visible });
});
window.addEventListener('online', () => wanted && connect());

function sendRaw(m: ClientMsg) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(m));
    return true;
  }
  return false;
}

export function send(m: ClientMsg) {
  if (!sendRaw(m)) toast('Not connected to your Mac');
}

export function subscribe(sessionId: string | null) {
  subscribed = sessionId;
  if (!sessionId || state.current?.sessionId !== sessionId) set({ current: null });
  sendRaw({ t: 'subscribe', sessionId });
}

let refreshTimer: number | undefined;
export async function refreshSessions() {
  try {
    set({ sessions: await api<SessionSummary[]>('/api/sessions') });
  } catch {
    /* offline banner covers it */
  }
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
      if (m.item.kind === 'approval' && m.item.status === 'pending') navigator.vibrate?.([30, 40, 30]);
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
      refreshTimer = window.setTimeout(refreshSessions, 250);
      // A session we're viewing stopped running: reload it as history.
      if (state.current?.live) {
        void api<SessionSummary[]>('/api/sessions').then((list) => {
          const me = list.find((s) => s.sessionId === state.current?.sessionId);
          if (state.current && me && !me.live) set({ current: { ...state.current, live: false, status: 'closed' } });
        }).catch(() => {});
      }
      break;
    case 'usage':
      set({ usage: m.usage });
      break;
    case 'error':
      toast(m.message);
      break;
  }
}

export async function loadMe() {
  const me = await api<Me & { usage: Usage }>('/api/me');
  set({ me, usage: me.usage ?? {} });
  return me;
}

export const actions = {
  send: (sessionId: string, text: string) => send({ t: 'send', sessionId, text }),
  decide: (sessionId: string, approvalId: string, decision: Decision) =>
    send({ t: 'decide', sessionId, approvalId, decision }),
  interrupt: (sessionId: string) => send({ t: 'interrupt', sessionId }),
  mode: (sessionId: string, mode: PermissionMode) => send({ t: 'mode', sessionId, mode }),
};

export function pendingApprovals(items: Item[]) {
  return items.filter((i): i is Extract<Item, { kind: 'approval' }> => i.kind === 'approval' && i.status === 'pending');
}
