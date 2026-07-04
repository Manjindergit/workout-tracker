import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { useLaunchStore } from '../stores/launchStore';
import { colors } from '../theme';

export default function RootLayout() {
  const ready = useLaunchStore((s) => s.ready);
  const initError = useLaunchStore((s) => s.initError);
  const init = useLaunchStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  if (initError) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorTitle}>Couldn’t open the database</Text>
        <Text style={styles.errorDetail}>{initError}</Text>
        <AppButton label="Retry" onPress={() => void init()} />
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="workout/new" options={{ title: 'Exercises' }} />
        <Stack.Screen name="workout/log" options={{ title: 'Workout' }} />
        <Stack.Screen name="session/[id]" options={{ title: 'Session' }} />
        <Stack.Screen name="exercise/[id]" options={{ title: 'Progress' }} />
        <Stack.Screen name="export" options={{ title: 'Export for AI', presentation: 'modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  errorDetail: { fontSize: 13, color: colors.subtle, textAlign: 'center' },
});
