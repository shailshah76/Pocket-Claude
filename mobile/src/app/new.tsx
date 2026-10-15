import { useState } from 'react';
import { KeyboardAvoidingView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PermissionMode } from '../../../shared/types';
import { api, toast, useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { base, tildify } from '@/lib/util';
import { Browser } from '@/components/Browser';
import { ModePicker } from '@/components/ModePicker';
import { Button, IconButton, s } from '@/components/ui';

export default function NewSession() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const me = useStore((st) => st.me);
  const [cwd, setCwd] = useState(me?.defaultDir ?? '~');
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<PermissionMode>('default');
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const r = await api<{ sessionId: string }>('/api/sessions', { body: { cwd, prompt, mode } });
      router.replace({ pathname: '/session/[id]', params: { id: r.sessionId } });
    } catch (e: any) {
      toast(e.message);
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.bgElev }}>
      <View style={{ paddingTop: insets.top + 8, paddingLeft: 20, paddingRight: 8, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[s.sheetTitle, { color: t.text }]}>New session</Text>
        <IconButton name="x" label="Close" onPress={() => router.back()} />
      </View>
      <View style={{ flex: 1, paddingTop: 8 }}>
        <Browser start={me?.defaultDir ?? '~'} onPath={setCwd} />
      </View>
      <View style={{ padding: 16, paddingBottom: insets.bottom + 12, gap: 10, borderTopWidth: 1, borderTopColor: t.border }}>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          multiline
          placeholder={`What should Claude do in ${base(cwd) || 'this folder'}?`}
          placeholderTextColor={t.text3}
          style={{ minHeight: 56, maxHeight: 140, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 14, padding: 12, color: t.text, fontSize: 16, backgroundColor: t.bg, textAlignVertical: 'top' }}
        />
        <ModePicker mode={mode} onChange={setMode} />
        <Button label={`Start in ${tildify(cwd, me?.home)}`} icon="folder" variant="primary" loading={busy} onPress={start} />
      </View>
    </KeyboardAvoidingView>
  );
}
