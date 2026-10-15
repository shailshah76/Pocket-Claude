import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { boot, useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { Toast } from '@/components/ui';
import { LockScreen } from '@/components/LockScreen';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const t = useTheme();
  const phase = useStore((s) => s.phase);
  const toast = useStore((s) => s.toast);

  useEffect(() => {
    void boot();
  }, []);
  useEffect(() => {
    if (phase !== 'boot') void SplashScreen.hideAsync();
  }, [phase]);
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(t.bg);
  }, [t.bg]);

  return (
    <SafeAreaProvider>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg }, animation: 'slide_from_right' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="session/[id]" />
          <Stack.Screen name="new" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="files" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="file" />
          <Stack.Screen name="settings" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="scan" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
        <Toast text={toast} />
        <LockScreen />
      </View>
    </SafeAreaProvider>
  );
}
