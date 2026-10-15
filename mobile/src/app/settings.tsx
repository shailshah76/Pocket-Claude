import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { forgetServer, signOut, useStore } from '@/lib/store';
import { fonts, useTheme } from '@/lib/theme';
import { tildify } from '@/lib/util';
import { Button, Icon, IconButton, SectionLabel, s } from '@/components/ui';

export default function Settings() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const me = useStore((st) => st.me);
  const server = useStore((st) => st.server);

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
