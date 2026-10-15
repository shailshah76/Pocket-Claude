import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { forgetServer, signOut, toast, useStore } from '@/lib/store';
import { setPrefs, usePrefs, type ThemePref } from '@/lib/prefs';
import { biometricKind, unlockWithBiometrics, type BiometricKind } from '@/lib/lock';
import { fonts, useTheme } from '@/lib/theme';
import { tildify } from '@/lib/util';
import { Button, Icon, IconButton, SectionLabel, s } from '@/components/ui';

export default function Settings() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const me = useStore((st) => st.me);
  const server = useStore((st) => st.server);
  const prefs = usePrefs();
  const [bio, setBio] = useState<BiometricKind | null | undefined>(undefined);
  useEffect(() => {
    void biometricKind().then(setBio);
  }, []);
  const bioLabel = bio === 'face' ? 'face' : bio === 'fingerprint' ? 'fingerprint' : 'fingerprint or face';

  return (
    <View style={{ flex: 1, backgroundColor: t.bgElev }}>
      <View style={{ paddingTop: insets.top + 8, paddingLeft: 20, paddingRight: 8, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[s.sheetTitle, { color: t.text }]}>Settings</Text>
        <IconButton name="x" label="Close" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 6 }}>
        <SectionLabel>Computer</SectionLabel>
        <Row k="Name" v={me?.host} />
        <Row k="Address" v={server?.replace(/^https?:\/\//, '')} />
        <Row k="Default folder" v={tildify(me?.defaultDir, me?.home)} onPress={() => router.push({ pathname: '/files', params: { pick: 'default' } })} />
        <Text style={{ color: t.text3, fontSize: 13, marginTop: 8, lineHeight: 19 }}>
          To change the PIN, run <Text style={{ fontFamily: fonts.mono }}>npm run setup</Text> on the computer.
        </Text>

        <SectionLabel style={{ marginTop: 22 }}>Appearance</SectionLabel>
        <ThemePicker value={prefs.theme} onChange={(theme) => setPrefs({ theme })} />

        <SectionLabel style={{ marginTop: 22 }}>Security</SectionLabel>
        <Toggle
          label="App lock"
          sub="Ask to unlock when you open Pocket Claude, and after 1 minute in the background."
          value={prefs.appLock}
          onChange={async (on) => {
            // Turning protection off needs the owner's fingerprint/face when the phone has one.
            if (!on && bio && prefs.biometrics && !(await unlockWithBiometrics())) return;
            setPrefs({ appLock: on });
            toast(on ? 'App lock on' : 'App lock off');
          }}
        />
        <Toggle
          label={`Unlock with ${bioLabel}`}
          sub={
            bio === null
              ? 'Set up fingerprint or face unlock in your phone’s settings to use it here. Until then the app asks for your PIN.'
              : 'Your Pocket Claude PIN always works as a backup.'
          }
          value={prefs.biometrics && !!bio}
          disabled={!bio || !prefs.appLock}
          onChange={(on) => setPrefs({ biometrics: on })}
        />

        <SectionLabel style={{ marginTop: 22 }}>Notifications</SectionLabel>
        <Text style={{ color: t.text2, fontSize: 14.5, lineHeight: 21 }}>
          While Pocket Claude is open, your phone vibrates when Claude needs approval. Background notifications aren’t enabled in this version.
        </Text>

        <View style={{ gap: 10, marginTop: 28 }}>
          <Button label="Sign out of this phone" icon="log-out" variant="danger" onPress={async () => (router.back(), await signOut())} />
          <Button label="Use a different computer" icon="monitor" variant="ghost" onPress={async () => (router.back(), await forgetServer())} />
        </View>
        <Text style={{ color: t.text3, fontSize: 12, textAlign: 'center', marginTop: 20 }}>Pocket Claude {Constants.expoConfig?.version}</Text>
      </ScrollView>
    </View>
  );
}

function Row({ k, v, onPress }: { k: string; v?: string; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: t.border }}>
      <Text style={{ color: t.text, fontSize: 15.5 }}>{k}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
        <Text style={{ color: onPress ? t.accent : t.text2, fontFamily: fonts.mono, fontSize: 13 }} numberOfLines={1}>{v}</Text>
        {onPress && <Icon name="chevron-right" size={16} color={t.accent} />}
      </View>
    </Pressable>
  );
}

const THEMES: { id: ThemePref; label: string; icon: 'smartphone' | 'sun' | 'moon' }[] = [
  { id: 'system', label: 'System', icon: 'smartphone' },
  { id: 'light', label: 'Light', icon: 'sun' },
  { id: 'dark', label: 'Dark', icon: 'moon' },
];

function ThemePicker({ value, onChange }: { value: ThemePref; onChange: (v: ThemePref) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.surface, borderRadius: 12, padding: 3, gap: 2, marginTop: 6 }} accessibilityRole="radiogroup">
      {THEMES.map((m) => {
        const on = value === m.id;
        return (
          <Pressable
            key={m.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(m.id)}
            style={{ flex: 1, height: 40, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              backgroundColor: on ? t.bgElev : 'transparent', elevation: on ? 2 : 0 }}
          >
            <Icon name={m.icon} size={15} color={on ? t.text : t.text2} />
            <Text style={{ color: on ? t.text : t.text2, fontWeight: '600', fontSize: 14 }}>{m.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Toggle({ label, sub, value, onChange, disabled }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.border, opacity: disabled ? 0.55 : 1 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 15.5 }}>{label}</Text>
        {!!sub && <Text style={{ color: t.text3, fontSize: 13, marginTop: 2, lineHeight: 18 }}>{sub}</Text>}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: t.green, false: t.surface2 }} thumbColor="#fff" accessibilityLabel={label} />
    </View>
  );
}
