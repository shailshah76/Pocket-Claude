import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ThemePref = 'system' | 'light' | 'dark';

export interface Prefs {
  theme: ThemePref;
  /** Ask for fingerprint/face (or the PIN) when opening the app. */
  appLock: boolean;
  /** Offer fingerprint/face on the lock screen; off means PIN only. */
  biometrics: boolean;
}

const KEY = 'prefs';
let prefs: Prefs = { theme: 'system', appLock: true, biometrics: true };
const listeners = new Set<() => void>();

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (raw) prefs = { ...prefs, ...JSON.parse(raw) };
  } catch {}
  applyTheme();
  listeners.forEach((l) => l());
  return prefs;
}

export const getPrefs = () => prefs;

export function setPrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch };
  if (patch.theme) applyTheme();
  listeners.forEach((l) => l());
  void SecureStore.setItemAsync(KEY, JSON.stringify(prefs)).catch(() => {});
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => prefs,
  );
}

function applyTheme() {
  // App-level override; 'unspecified' follows the phone's own setting (RN 0.86 API).
  Appearance.setColorScheme(prefs.theme === 'system' ? 'unspecified' : prefs.theme);
}
