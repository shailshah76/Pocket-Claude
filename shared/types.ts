// Wire protocol shared by the Mac bridge server and the phone PWA.

export type SessionStatus = 'starting' | 'running' | 'waiting' | 'idle' | 'error' | 'closed';
export type PermissionMode = 'default' | 'acceptEdits' | 'plan';

export interface Question {
  question: string;
  header?: string;
  multiSelect?: boolean;
  options: { label: string; description?: string }[];
}

export type Item =
  | { kind: 'user'; id: string; text: string; ts?: number }
  | { kind: 'text'; id: string; text: string; streaming?: boolean }
  | { kind: 'thinking'; id: string; text: string }
  | {
      kind: 'tool';
      id: string;
      name: string;
      input: Record<string, unknown>;
      status: 'running' | 'done' | 'error';
      output?: string;
    }
  | {
      kind: 'approval';
      id: string;
      toolUseId: string;
      toolName: string;
      input: Record<string, unknown>;
      title?: string;
      description?: string;
      reason?: string;
      canAlwaysAllow: boolean;
      status: 'pending' | 'allowed' | 'denied' | 'cancelled';
    }
  | { kind: 'result'; id: string; ok: boolean; durationMs: number; turns: number; error?: string }
  | { kind: 'notice'; id: string; level: 'info' | 'error'; text: string };

export interface SessionSummary {
  sessionId: string;
  title: string;
  cwd?: string;
  lastModified: number;
  gitBranch?: string;
  /** Currently running inside the bridge (controllable from the phone). */
  live: boolean;
  status?: SessionStatus;
  pendingApprovals?: number;
}

export interface SessionState {
  sessionId: string;
  cwd: string;
  title: string;
  live: boolean;
  status: SessionStatus;
  mode: PermissionMode;
  model?: string;
  lastModified: number;
  items: Item[];
}

export interface Usage {
  fiveHour?: { utilization: number; resetsAt: number };
  sevenDay?: { utilization: number; resetsAt: number };
}

export type Decision =
  | { type: 'allow' }
  | { type: 'allow_always' }
  | { type: 'deny'; message?: string }
  | { type: 'answer'; answers: Record<string, string> };

export type ClientMsg =
  | { t: 'subscribe'; sessionId: string | null }
  | { t: 'send'; sessionId: string; text: string }
  | { t: 'decide'; sessionId: string; approvalId: string; decision: Decision }
  | { t: 'interrupt'; sessionId: string }
  | { t: 'mode'; sessionId: string; mode: PermissionMode }
  | { t: 'visibility'; visible: boolean };

export type ServerMsg =
  | { t: 'state'; state: SessionState }
  | { t: 'item'; sessionId: string; item: Item }
  | { t: 'status'; sessionId: string; status: SessionStatus; mode: PermissionMode; model?: string }
  | { t: 'sessions_changed' }
  | { t: 'usage'; usage: Usage }
  | { t: 'error'; message: string };

export interface FsEntry {
  name: string;
  type: 'dir' | 'file';
  size: number;
  mtime: number;
}

export interface FsListing {
  path: string;
  parent: string | null;
  entries: FsEntry[];
}
