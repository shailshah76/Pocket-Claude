// Android/Chrome fires `beforeinstallprompt` once; keep it so a button can show the native install sheet later.
import { useSyncExternalStore } from 'react';

let deferred: any = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  emit();
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  emit();
});

export function useInstallPrompt(): (() => Promise<void>) | null {
  const ev = useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => deferred);
  return ev
    ? async () => {
        await ev.prompt();
        await ev.userChoice.catch(() => {});
        deferred = null;
        emit();
      }
    : null;
}
