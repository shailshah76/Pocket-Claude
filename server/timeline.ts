import type { Item } from '../shared/types.js';

const MAX_OUTPUT = 24_000;

type Block = { type: string; [k: string]: any };

/**
 * Ordered, id-addressable list of chat items built from Claude Code messages —
 * both live SDK messages and historical transcript entries share this path.
 */
export class Timeline {
  items: Item[] = [];
  private index = new Map<string, number>();
  // Streaming text: message id -> ids of live text items not yet finalized.
  private openText = new Map<string, string[]>();
  private streamMsgId = '';
  private streamBlocks = new Map<number, string>();

  constructor(public onChange: (item: Item) => void = () => {}) {}

  upsert(item: Item): void {
    const i = this.index.get(item.id);
    if (i === undefined) {
      this.index.set(item.id, this.items.length);
      this.items.push(item);
    } else {
      this.items[i] = item;
    }
    this.onChange(item);
  }

  get(id: string): Item | undefined {
    const i = this.index.get(id);
    return i === undefined ? undefined : this.items[i];
  }

  /** Raw Anthropic stream event (live sessions only). Returns the item touched, if any. */
  streamEvent(ev: any): void {
    if (ev.type === 'message_start') {
      this.streamMsgId = ev.message?.id ?? '';
      this.streamBlocks.clear();
    } else if (ev.type === 'content_block_start' && ev.content_block?.type === 'text') {
      const id = `${this.streamMsgId}-s${ev.index}`;
      this.streamBlocks.set(ev.index, id);
      const q = this.openText.get(this.streamMsgId) ?? [];
      q.push(id);
      this.openText.set(this.streamMsgId, q);
      this.upsert({ kind: 'text', id, text: ev.content_block.text ?? '', streaming: true });
    } else if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
      const id = this.streamBlocks.get(ev.index);
      const item = id ? this.get(id) : undefined;
      if (item?.kind === 'text') this.upsert({ ...item, text: item.text + ev.delta.text });
    }
  }

  /** An assistant message (live or historical). */
  assistant(msg: any, fallbackId: string): void {
    const content: Block[] = Array.isArray(msg?.content) ? msg.content : [];
    content.forEach((b, i) => {
      if (b.type === 'text') {
        const pending = this.openText.get(msg.id);
        const liveId = pending?.shift();
        this.upsert({ kind: 'text', id: liveId ?? `${fallbackId}-${i}`, text: b.text ?? '' });
      } else if (b.type === 'thinking' && b.thinking) {
        this.upsert({ kind: 'thinking', id: `${fallbackId}-${i}`, text: b.thinking });
      } else if (b.type === 'tool_use') {
        this.upsert({ kind: 'tool', id: b.id, name: b.name, input: b.input ?? {}, status: 'running' });
      }
    });
  }

  /** A user message. `includeText` is false for live sessions, where we add the bubble on send. */
  user(msg: any, fallbackId: string, includeText: boolean): void {
    const content = msg?.content;
    if (typeof content === 'string') {
      if (includeText) this.userText(content, fallbackId);
      return;
    }
    if (!Array.isArray(content)) return;
    const texts: string[] = [];
    for (const b of content as Block[]) {
      if (b.type === 'tool_result') {
        const tool = this.get(b.tool_use_id);
        if (tool?.kind === 'tool') {
          this.upsert({ ...tool, status: b.is_error ? 'error' : 'done', output: flatten(b.content) });
        }
      } else if (b.type === 'text') {
        texts.push(b.text);
      } else if (b.type === 'image') {
        texts.push('[image]');
      }
    }
    if (includeText && texts.length) this.userText(texts.join('\n'), fallbackId);
  }

  private userText(raw: string, id: string): void {
    const cmd = raw.match(/<command-name>(.*?)<\/command-name>/s);
    if (cmd) {
      const args = raw.match(/<command-args>(.*?)<\/command-args>/s)?.[1]?.trim();
      this.upsert({ kind: 'user', id, text: args ? `${cmd[1]} ${args}` : cmd[1] });
      return;
    }
    // Transcript plumbing (command stdout, reminders, interrupt markers) isn't conversation.
    const t = raw.trim();
    if (!t || t.startsWith('<') || t.startsWith('Caveat:') || t.startsWith('[Request interrupted')) return;
    this.upsert({ kind: 'user', id, text: raw });
  }

  /** Any tool still marked running when a turn ends was interrupted. */
  settleRunningTools(): void {
    for (const it of this.items) {
      if (it.kind === 'tool' && it.status === 'running') this.upsert({ ...it, status: 'error', output: it.output ?? 'Interrupted' });
      if (it.kind === 'text' && it.streaming) this.upsert({ ...it, streaming: false });
    }
    this.openText.clear();
  }
}

function flatten(content: unknown): string {
  let s: string;
  if (typeof content === 'string') s = content;
  else if (Array.isArray(content)) s = content.map((c: any) => (c?.type === 'text' ? c.text : c?.type === 'image' ? '[image]' : '')).join('\n');
  else s = '';
  return s.length > MAX_OUTPUT ? s.slice(0, MAX_OUTPUT) + `\n… (${s.length - MAX_OUTPUT} more characters)` : s;
}
