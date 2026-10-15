import { AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { getPrefs } from './prefs';
import { api, getState, setLocked } from './store';

/** Re-lock after this long in the background. */
const RELOCK_AFTER_MS = 60_000;
let backgroundedAt: number | null = null;

AppState.addEventListener('change', (s) => {
  if (s === 'background') {
    backgroundedAt = Date.now();
  } else if (s === 'active') {
    const away = backgroundedAt ? Date.now() - backgroundedAt : 0;
    backgroundedAt = null;
    const st = getState();
    if (getPrefs().appLock && st.phase === 'ready' && !st.locked && away > RELOCK_AFTER_MS) setLocked(true);
  }
});

export type BiometricKind = 'fingerprint' | 'face' | 'biometrics';

/** What the device can do right now, or null when there is no usable enrolled biometric. */
export async function biometricKind(): Promise<BiometricKind | null> {
  try {
    if (!(await LocalAuthentication.hasHardwareAsync()) || !(await LocalAuthentication.isEnrolledAsync())) return null;
    // Only strong (class 3) biometrics may unlock: camera-only face unlock is too easy to fool.
    if ((await LocalAuthentication.getEnrolledLevelAsync()) < LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG) return null;
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    return finger && face ? 'biometrics' : finger ? 'fingerprint' : face ? 'face' : 'biometrics';
  } catch {
    return null;
  }
}

/** Shows the system prompt. Returns true when unlocked; false when cancelled or failed (PIN is the fallback). */
export async function unlockWithBiometrics(): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Pocket Claude',
    promptSubtitle: getState().host ? `Connected to ${getState().host}` : undefined,
    cancelLabel: 'Use PIN',
    disableDeviceFallback: true, // the fallback is the Pocket Claude PIN, not the phone passcode
    biometricsSecurityLevel: 'strong',
    requireConfirmation: false,
  }).catch(() => ({ success: false }) as const);
  if (r.success) setLocked(false);
  return r.success;
}

/** PIN fallback: checked by the Mac, with the same lockout as signing in. Returns an error message on failure. */
export async function unlockWithPin(pin: string): Promise<string | void> {
  try {
    await api('/api/verify-pin', { body: { pin } });
    setLocked(false);
  } catch (e: any) {
    if (e.status === 429) return `Too many attempts. Try again in ${Math.ceil((e.body?.retryAfterMs ?? 60000) / 60000)} min.`;
    if (e.status === 0) return 'Can’t reach your computer to check the PIN. Use your fingerprint, or try again when it’s online.';
    return 'Wrong PIN';
  }
}
