import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { check, connectServer, forgetServer, parseServer, setPendingSetupCode, useStore } from '@/lib/store';
import { fonts, useTheme } from '@/lib/theme';
import { Button, Icon } from '@/components/ui';

const icon = require('../../assets/icon.png');

/** Shared by the Connect screen and the QR scanner. Returns an error message, or nothing on success. */
export async function connectTo(input: string): Promise<string | void> {
  const parsed = parseServer(input);
  if (!parsed) return 'That doesn’t look like an address.';
  try {
    await connectServer(parsed.url);
    if (parsed.code) setPendingSetupCode(parsed.code);
  } catch (e: any) {
    return e.status === 0
      ? `Couldn’t reach ${parsed.url}. Check that Tailscale is on (on this phone and the computer) and that the computer is awake.`
      : e.message;
  }
}

export function Connect() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [addr, setAddr] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const go = async () => {
    setBusy(true);
    setErr('');
    const e = await connectTo(addr);
    setBusy(false);
    if (e) setErr(e);
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, gap: 22 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: 14 }}>
          <Image source={icon} style={{ width: 76, height: 76, borderRadius: 22 }} />
          <Text style={{ fontFamily: fonts.serif, fontSize: 32, color: t.text, fontWeight: '500' }}>Pocket Claude</Text>
          <Text style={{ color: t.text2, fontSize: 15.5, textAlign: 'center', lineHeight: 22 }}>
            Use Claude Code on your computer from your phone.
          </Text>
        </View>

        <View style={{ backgroundColor: t.surface, borderRadius: 18, padding: 16, gap: 10 }}>
          <Step n={1}>On your computer, in the pocket-claude folder, run{'\n'}
            <Text style={{ fontFamily: fonts.mono, color: t.text }}>npm run onboard</Text>
          </Step>
          <Step n={2}>Scan the QR code it shows, or type the address below.</Step>
        </View>

        <Button label="Scan QR code" icon="camera" variant="primary" onPress={() => router.push('/scan')} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
          <Text style={{ color: t.text3, fontSize: 13 }}>or enter the address</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: t.border }} />
        </View>

        <View style={{ gap: 10 }}>
          <TextInput
            value={addr}
            onChangeText={(v) => (setAddr(v), setErr(''))}
            onSubmitEditing={go}
            placeholder="your-mac.tail1234.ts.net"
            placeholderTextColor={t.text3}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            style={{ height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: t.borderStrong, backgroundColor: t.bgElev, paddingHorizontal: 14, color: t.text, fontSize: 16, fontFamily: fonts.mono }}
          />
          {!!err && <Text style={{ color: t.red, fontSize: 14 }}>{err}</Text>}
          <Button label="Connect" icon="link" onPress={go} disabled={!addr.trim()} loading={busy} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: t.accent, fontWeight: '700', fontSize: 13 }}>{n}</Text>
      </View>
      <Text style={{ flex: 1, color: t.text2, fontSize: 14.5, lineHeight: 21 }}>{children}</Text>
    </View>
  );
}

export function Unreachable() {
  const t = useTheme();
  const server = useStore((s) => s.server);
  const [busy, setBusy] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: t.amberSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="wifi-off" size={28} color={t.amber} />
      </View>
      <Text style={{ fontFamily: fonts.serif, fontSize: 24, color: t.text }}>Can’t reach your computer</Text>
      <Text style={{ color: t.text2, textAlign: 'center', lineHeight: 21 }}>
        It may be asleep, or Tailscale is off on this phone or the computer.
      </Text>
      <Text style={{ color: t.text3, fontFamily: fonts.mono, fontSize: 12.5 }}>{server}</Text>
      <Button label="Try again" icon="refresh-cw" variant="primary" loading={busy} onPress={async () => (setBusy(true), await check(), setBusy(false))} />
      <Pressable onPress={() => void forgetServer()} hitSlop={10}>
        <Text style={{ color: t.text2, fontWeight: '500' }}>Use a different computer</Text>
      </Pressable>
      {busy && <ActivityIndicator color={t.accent} />}
    </View>
  );
}
