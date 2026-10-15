import { useSyncExternalStore } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'pc:theme';
const BG = { light: '#faf9f5', dark: '#141413' };
const listeners = new Set<() => void>();

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

let pref = read();

function apply() {
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
  // Keep the browser/status bar color in step with the forced theme.
  const effective = pref === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : pref;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', BG[effective]));
}

export function setTheme(next: ThemePref) {
  pref = next;
  try {
    if (next === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {}
  apply();
  listeners.forEach((l) => l());
}

export function useTheme(): ThemePref {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => pref);
}

apply();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => pref === 'system' && apply());
