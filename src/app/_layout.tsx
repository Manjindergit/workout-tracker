import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useLaunchStore } from '../stores/launchStore';
import { colors } from '../theme';

export default function RootLayout() {
  const ready = useLaunchStore((s) => s.ready);
  const init = useLaunchStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

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
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
