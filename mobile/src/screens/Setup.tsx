import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { forgetServer, pendingSetupCode, setPendingSetupCode, signIn, useStore } from '@/lib/store';
import { fonts, useTheme } from '@/lib/theme';
import { PinPad } from '@/components/PinPad';
import { Button } from '@/components/ui';

const icon = require('../../assets/icon.png');
const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

/** First run: prove you're at the computer (code from its terminal), then choose a PIN. */
export function Setup() {
  const t = useTheme();
  const host = useStore((s) => s.host);
  const [code, setCode] = useState(() => clean(pendingSetupCode));
  const [step, setStep] = useState<'code' | 'pin' | 'confirm'>(() => (clean(pendingSetupCode).length === 8 ? 'pin' : 'code'));
  const [first, setFirst] = useState('');
  const [codeErr, setCodeErr] = useState('');

  if (step === 'code') {
    return (
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.bg, justifyContent: 'center', padding: 24, gap: 18 }}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Image source={icon} style={{ width: 70, height: 70, borderRadius: 20 }} />
          <Text style={{ fontFamily: fonts.serif, fontSize: 30, color: t.text }}>Welcome</Text>
          <Text style={{ color: t.text2, fontSize: 15, textAlign: 'center' }}>
            Let’s connect this phone to <Text style={{ color: t.text, fontWeight: '700' }}>{host}</Text>.
          </Text>
        </View>
        <Text style={{ color: t.text3, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.8 }}>SETUP CODE</Text>
        <TextInput
          value={code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code}
          onChangeText={(v) => (setCode(clean(v)), setCodeErr(''))}
          placeholder="XXXX-XXXX"
          placeholderTextColor={t.text3}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          // No suggestion strip for a one-time code.
          keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
          autoFocus
          style={{ height: 66, borderRadius: 16, borderWidth: 1.5, borderColor: codeErr ? t.red : t.borderStrong, backgroundColor: t.bgElev,
            textAlign: 'center', fontFamily: fonts.mono, fontSize: 28, fontWeight: '700', letterSpacing: 3, color: t.text }}
        />
        <Text style={{ color: t.text3, fontSize: 13.5, textAlign: 'center' }}>Shown in the terminal on your computer.</Text>
        {!!codeErr && <Text style={{ color: t.red, textAlign: 'center' }}>{codeErr}</Text>}
        <Button label="Continue" icon="arrow-right" variant="primary" disabled={code.length !== 8} onPress={() => setStep('pin')} />
        <Pressable onPress={() => void forgetServer()} style={{ alignSelf: 'center' }} hitSlop={10}>
          <Text style={{ color: t.text2 }}>Use a different computer</Text>
        </Pressable>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'pin') {
    return (
      <PinPad
        key="pin"
        title="Choose a PIN"
        subtitle="6–12 digits. You’ll use it to sign in."
        submitLabel="Next"
        onSubmit={async (pin) => {
          setFirst(pin);
          setStep('confirm');
        }}
        footer={<Pressable onPress={() => setStep('code')} hitSlop={10}><Text style={{ color: t.text2 }}>Back</Text></Pressable>}
      />
    );
  }

  return (
    <PinPad
      key="confirm"
      title="Confirm your PIN"
      subtitle="Enter it once more"
      submitLabel="Done"
      onSubmit={async (pin) => {
        if (pin !== first) {
          setTimeout(() => setStep('pin'), 900);
          return 'PINs didn’t match. Let’s try again.';
        }
        try {
          await signIn('/api/setup', { code, pin });
          setPendingSetupCode('');
        } catch (e: any) {
          if (e.status === 429) return `Too many attempts. Try again in ${Math.ceil((e.body?.retryAfterMs ?? 60000) / 60000)} min.`;
          if (/setup code/.test(e.message)) {
            setCodeErr('That code didn’t match. Check the terminal on your computer.');
            setStep('code');
            return;
          }
          return e.message;
        }
      }}
    />
  );
}
