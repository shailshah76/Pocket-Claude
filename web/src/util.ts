export function ago(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function dayBucket(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000;
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return 'This week';
  return 'Earlier';
}

export function tildify(p: string | undefined, home: string | undefined): string {
  if (!p) return '';
  if (home && (p === home || p.startsWith(home + '/'))) return '~' + p.slice(home.length);
  return p;
}

export function base(p: string | undefined): string {
  if (!p) return '';
  const parts = p.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '/';
}

export function relTo(p: string, cwd: string | undefined): string {
  if (cwd && p.startsWith(cwd + '/')) return p.slice(cwd.length + 1);
  return p;
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function duration(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
