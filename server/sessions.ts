import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import {
  query,
  listSessions,
  getSessionMessages,
  getSessionInfo,
  type Query,
  type SDKMessage,
  type SDKUserMessage,
  type PermissionResult,
} from '@anthropic-ai/claude-agent-sdk';
import { Timeline } from './timeline.js';
import type {
  Decision,
  Item,
  PermissionMode,
  ServerMsg,
  SessionState,
  SessionStatus,
  SessionSummary,
  Usage,
} from '../shared/types.js';

const IDLE_CLOSE_MS = 30 * 60_000;
const STREAM_FLUSH_MS = 60;

export interface HubEvents {
  broadcast(sessionId: string | null, msg: ServerMsg): void;
  notify(kind: 'approval' | 'done' | 'error', rt: Runtime, body: string): void;
}

/** Async iterable fed by the phone: each `push` becomes a user turn. */
class InputQueue implements AsyncIterable<SDKUserMessage> {
  private buf: SDKUserMessage[] = [];
  private wake: (() => void) | null = null;
  private closed = false;

  push(msg: SDKUserMessage): void {
    this.buf.push(msg);
    this.wake?.();
  }
  close(): void {
    this.closed = true;
    this.wake?.();
  }
  async *[Symbol.asyncIterator]() {
    while (true) {
      while (this.buf.length) yield this.buf.shift()!;
      if (this.closed) return;
      await new Promise<void>((r) => (this.wake = r));
      this.wake = null;
    }
  }
}

interface Pending {
  resolve: (r: PermissionResult) => void;
  input: Record<string, unknown>;
  suggestions?: unknown[];
}

export class Runtime {
  readonly id: string;
  readonly cwd: string;
  readonly forked: boolean;
  title: string;
  status: SessionStatus = 'idle';
  mode: PermissionMode = 'default';
  model?: string;
  lastModified = Date.now();
  timeline: Timeline;

  private q!: Query;
  private input = new InputQueue();
  private pending = new Map<string, Pending>();
  private dirty = new Map<string, Item>();
  private flushTimer: NodeJS.Timeout | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private lastText = '';

  constructor(
    opts: { id: string; cwd: string; title: string; history: Item[]; resume?: string; fork?: boolean },
    private hub: HubEvents,
    private onClosed: (rt: Runtime) => void,
  ) {
    this.id = opts.id;
    this.cwd = opts.cwd;
    this.forked = !!opts.fork;
    this.title = opts.title;
    // History is indexed silently; only changes after this point are broadcast.
    this.timeline = new Timeline();
    for (const it of opts.history) this.timeline.upsert(it);
    this.timeline.onChange = (item) => this.queueItem(item);
    this.touch();

    const sessionOpts = opts.resume
      ? { resume: opts.resume, ...(opts.fork ? { forkSession: true, sessionId: opts.id } : {}) }
      : { sessionId: opts.id };

    this.q = query({
      prompt: this.input,
      options: {
        cwd: opts.cwd,
        ...sessionOpts,
        includePartialMessages: true,
        permissionMode: this.mode,
        systemPrompt: { type: 'preset', preset: 'claude_code' },
        canUseTool: (toolName, input, o) => this.askPermission(toolName, input, o),
        stderr: (data) => process.stderr.write(`[claude ${this.id.slice(0, 8)}] ${data}`),
      },
    });
    void this.pump();
  }

  // ── inbound from phone ────────────────────────────────────────────────
  send(text: string): void {
    this.touch();
    this.timeline.upsert({ kind: 'user', id: `u-${randomUUID()}`, text, ts: Date.now() });
    this.input.push({
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null,
      session_id: this.id,
    } as SDKUserMessage);
    this.setStatus('running');
  }

  decide(approvalId: string, d: Decision): void {
    const p = this.pending.get(approvalId);
    const item = this.timeline.get(approvalId);
    if (!p || item?.kind !== 'approval') return;
    this.pending.delete(approvalId);
    this.touch();
    let result: PermissionResult;
    let status: 'allowed' | 'denied' = 'allowed';
    switch (d.type) {
      case 'allow':
        result = { behavior: 'allow', updatedInput: p.input };
        break;
      case 'allow_always':
        result = { behavior: 'allow', updatedInput: p.input, updatedPermissions: p.suggestions as any };
        break;
      case 'answer':
        result = { behavior: 'allow', updatedInput: { ...p.input, answers: d.answers } };
        break;
      default:
        status = 'denied';
        result = { behavior: 'deny', message: d.message?.trim() || 'The user denied this from their phone.' };
    }
    this.timeline.upsert({ ...item, status, ...(d.type === 'answer' ? { input: { ...item.input, answers: d.answers } } : {}) });
    p.resolve(result);
    if (this.pending.size === 0) this.setStatus('running');
  }

  async interrupt(): Promise<void> {
    for (const id of [...this.pending.keys()]) this.decide(id, { type: 'deny', message: 'Interrupted by user.' });
    await this.q.interrupt().catch(() => {});
  }

  async setMode(mode: PermissionMode): Promise<void> {
    await this.q.setPermissionMode(mode);
    this.mode = mode;
    this.emitStatus();
  }

  close(): void {
    this.input.close();
    this.q.close();
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  state(): SessionState {
    this.flush();
    return {
      sessionId: this.id,
      cwd: this.cwd,
      title: this.title,
      live: true,
      status: this.status,
      mode: this.mode,
      model: this.model,
      lastModified: this.lastModified,
      items: this.timeline.items,
    };
  }

  // ── Claude → phone ────────────────────────────────────────────────────
  private async pump(): Promise<void> {
    try {
      for await (const m of this.q) this.handle(m);
      this.finish('closed');
    } catch (err: any) {
      this.timeline.upsert({ kind: 'notice', id: `n-${randomUUID()}`, level: 'error', text: String(err?.message ?? err) });
      this.hub.notify('error', this, String(err?.message ?? err));
      this.finish('error');
    }
  }

  private handle(m: SDKMessage): void {
    this.lastModified = Date.now();
    const anyM = m as any;
    if (anyM.parent_tool_use_id) return; // subagent internals stay inside their Task card
    switch (m.type) {
      case 'stream_event':
        this.timeline.streamEvent(anyM.event);
        break;
      case 'assistant':
        this.timeline.assistant(anyM.message, anyM.uuid);
        for (const b of anyM.message?.content ?? []) if (b.type === 'text' && b.text) this.lastText = b.text;
        break;
      case 'user':
        this.timeline.user(anyM.message, anyM.uuid, false);
        break;
      case 'result': {
        this.timeline.settleRunningTools();
        const ok = anyM.subtype === 'success' && !anyM.is_error;
        this.timeline.upsert({
          kind: 'result',
          id: `r-${anyM.uuid}`,
          ok,
          durationMs: anyM.duration_ms ?? 0,
          turns: anyM.num_turns ?? 0,
          error: ok ? undefined : (anyM.errors?.join('\n') || anyM.result || anyM.subtype),
        });
        this.setStatus('idle');
        this.hub.notify(ok ? 'done' : 'error', this, ok ? this.lastText : `Stopped: ${anyM.subtype}`);
        this.touch();
        break;
      }
      case 'system':
        if (anyM.subtype === 'init') {
          this.model = anyM.model;
          if (anyM.permissionMode && anyM.permissionMode in MODES) this.mode = anyM.permissionMode;
          this.emitStatus();
        } else if (anyM.subtype === 'status') {
          if (anyM.permissionMode && anyM.permissionMode in MODES && anyM.permissionMode !== this.mode) {
            this.mode = anyM.permissionMode;
            this.emitStatus();
          }
        }
        break;
      case 'rate_limit_event': {
        const w = anyM.rate_limit_info?.unifiedWindows ?? {};
        const usage: Usage = {
          fiveHour: w.five_hour && { utilization: w.five_hour.utilization, resetsAt: w.five_hour.resetsAt * 1000 },
          sevenDay: w.seven_day && { utilization: w.seven_day.utilization, resetsAt: w.seven_day.resetsAt * 1000 },
        };
        latestUsage = usage;
        this.hub.broadcast(null, { t: 'usage', usage });
        break;
      }
    }
  }

  private askPermission(toolName: string, input: Record<string, unknown>, o: any): Promise<PermissionResult> {
    this.touch();
    const id = `ap-${o.toolUseID}`;
    const item: Item = {
      kind: 'approval',
      id,
      toolUseId: o.toolUseID,
      toolName,
      input,
      title: o.title,
      description: o.description,
      reason: o.decisionReason,
      canAlwaysAllow: toolName !== 'AskUserQuestion' && !!o.suggestions?.length && !o.suppressAlwaysAllowRule,
      status: 'pending',
    };
    this.timeline.upsert(item);
    this.flush();
    this.setStatus('waiting');
    const body =
      toolName === 'AskUserQuestion'
        ? 'Claude has a question for you'
        : o.title || `${toolName}: ${summarize(toolName, input)}`;
    this.hub.notify('approval', this, body);
    return new Promise((resolve) => {
      this.pending.set(id, { resolve, input, suggestions: o.suggestions });
      o.signal?.addEventListener('abort', () => {
        if (!this.pending.delete(id)) return;
        const cur = this.timeline.get(id);
        if (cur?.kind === 'approval') this.timeline.upsert({ ...cur, status: 'cancelled' });
        resolve({ behavior: 'deny', message: 'Cancelled.' });
        if (this.pending.size === 0 && this.status === 'waiting') this.setStatus('running');
      });
    });
  }

  // ── plumbing ──────────────────────────────────────────────────────────
  private queueItem(item: Item): void {
    this.dirty.set(item.id, item);
    // Approvals and non-streaming items go out immediately; token deltas are batched.
    if (item.kind === 'text' && item.streaming) {
      this.flushTimer ??= setTimeout(() => this.flush(), STREAM_FLUSH_MS);
    } else {
      this.flush();
    }
  }

  private flush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    for (const item of this.dirty.values()) this.hub.broadcast(this.id, { t: 'item', sessionId: this.id, item });
    this.dirty.clear();
  }

  private setStatus(s: SessionStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.emitStatus();
    this.hub.broadcast(null, { t: 'sessions_changed' });
  }

  private emitStatus(): void {
    this.hub.broadcast(this.id, { t: 'status', sessionId: this.id, status: this.status, mode: this.mode, model: this.model });
  }

  private touch(): void {
    this.lastModified = Date.now();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.status === 'idle' && this.pending.size === 0) this.close();
      else this.touch();
    }, IDLE_CLOSE_MS);
  }

  private finish(s: SessionStatus): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.timeline.settleRunningTools();
    this.flush();
    this.setStatus(s);
    this.onClosed(this);
  }
}

const MODES: Record<PermissionMode, true> = { default: true, acceptEdits: true, plan: true };
let latestUsage: Usage = {};

export function summarize(tool: string, input: Record<string, any>): string {
  switch (tool) {
    case 'Bash':
      return String(input.command ?? '');
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return String(input.file_path ?? input.notebook_path ?? '');
    case 'Glob':
    case 'Grep':
      return String(input.pattern ?? '');
    case 'WebFetch':
      return String(input.url ?? '');
    case 'WebSearch':
      return String(input.query ?? '');
    case 'Task':
    case 'Agent':
      return String(input.description ?? '');
    default:
      return '';
  }
}

/** Owns every live runtime and answers session queries. */
export class SessionHub {
  private runtimes = new Map<string, Runtime>();

  constructor(private events: HubEvents) {}

  get usage(): Usage {
    return latestUsage;
  }

  live(id: string): Runtime | undefined {
    return this.runtimes.get(id);
  }

  async list(): Promise<SessionSummary[]> {
    const stored = await listSessions({ limit: 80 }).catch(() => []);
    const out = new Map<string, SessionSummary>();
    for (const s of stored) {
      out.set(s.sessionId, {
        sessionId: s.sessionId,
        title: s.customTitle || s.summary || s.firstPrompt || 'Untitled',
        cwd: s.cwd,
        lastModified: s.lastModified,
        gitBranch: s.gitBranch,
        live: false,
      });
    }
    for (const rt of this.runtimes.values()) {
      const prev = out.get(rt.id);
      out.set(rt.id, {
        sessionId: rt.id,
        title: prev?.title && prev.title !== 'Untitled' && !rt.forked ? prev.title : rt.title,
        cwd: rt.cwd,
        lastModified: Math.max(rt.lastModified, prev?.lastModified ?? 0),
        gitBranch: prev?.gitBranch,
        live: true,
        status: rt.status,
        pendingApprovals: rt.pendingCount,
      });
    }
    return [...out.values()].sort((a, b) => Number(b.live) - Number(a.live) || b.lastModified - a.lastModified);
  }

  async history(id: string): Promise<Item[]> {
    const msgs = await getSessionMessages(id).catch(() => []);
    const tl = new Timeline();
    for (const m of msgs as any[]) {
      if (m.parent_tool_use_id) continue;
      if (m.type === 'assistant') tl.assistant(m.message, m.uuid);
      else if (m.type === 'user') tl.user(m.message, m.uuid, true);
    }
    tl.settleRunningTools();
    // Tools left running in a transcript just weren't recorded finishing; don't call them errors.
    return tl.items.map((it) => (it.kind === 'tool' && it.output === 'Interrupted' ? { ...it, status: 'done', output: undefined } : it));
  }

  async state(id: string): Promise<SessionState | null> {
    const rt = this.runtimes.get(id);
    if (rt) return rt.state();
    const info = await getSessionInfo(id).catch(() => undefined);
    if (!info) return null;
    return {
      sessionId: id,
      cwd: info.cwd ?? '',
      title: info.customTitle || info.summary || info.firstPrompt || 'Untitled',
      live: false,
      status: 'closed',
      mode: 'default',
      lastModified: info.lastModified,
      items: await this.history(id),
    };
  }

  /** Start a brand-new session, or bring a stored one to life (continue or fork). */
  async start(opts: { cwd: string; prompt?: string; resumeId?: string; fork?: boolean; mode?: PermissionMode }): Promise<Runtime> {
    if (opts.resumeId && !opts.fork) {
      const existing = this.runtimes.get(opts.resumeId);
      if (existing) {
        if (opts.prompt) existing.send(opts.prompt);
        return existing;
      }
    }
    let history: Item[] = [];
    let title = opts.prompt?.slice(0, 80) || `New session in ${basename(opts.cwd) || '/'}`;
    let cwd = opts.cwd;
    if (opts.resumeId) {
      const st = await this.state(opts.resumeId);
      if (!st) throw new Error('Session not found');
      history = st.items;
      title = opts.fork ? `${st.title} (fork)` : st.title;
      cwd = st.cwd || cwd;
    }
    const id = opts.resumeId && !opts.fork ? opts.resumeId : randomUUID();
    const rt = new Runtime({ id, cwd, title, history, resume: opts.resumeId, fork: opts.fork }, this.events, (r) => {
      if (this.runtimes.get(r.id) === r) this.runtimes.delete(r.id);
      this.events.broadcast(null, { t: 'sessions_changed' });
    });
    this.runtimes.set(id, rt);
    if (opts.mode && opts.mode !== 'default') await rt.setMode(opts.mode).catch(() => {});
    if (opts.prompt) rt.send(opts.prompt);
    this.events.broadcast(null, { t: 'sessions_changed' });
    return rt;
  }

  closeAll(): void {
    for (const rt of this.runtimes.values()) rt.close();
  }
}
