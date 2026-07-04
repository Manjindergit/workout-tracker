import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { EmptyState } from '../../components/EmptyState';
import { SessionCard } from '../../components/SessionCard';
import { getRepos } from '../../db/appDb';
import { ActiveSessionExistsError } from '../../db/repositories/sessionRepo';
import { useActiveWorkoutStore } from '../../stores/activeWorkout';
import { useLaunchStore } from '../../stores/launchStore';
import { colors } from '../../theme';
import type { Session, SessionSummary } from '../../types/domain';
import { formatLocalTime } from '../../utils/dates';

export default function HomeScreen() {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [recent, setRecent] = useState<SessionSummary[]>([]);
  const staleNotice = useLaunchStore((s) => s.staleNotice);
  const dismissNotice = useLaunchStore((s) => s.dismissNotice);
  const workout = useActiveWorkoutStore();

  const reload = useCallback(async () => {
    const repos = await getRepos();
    setActiveSession(await repos.sessions.findActive());
    setRecent(await repos.sessions.listFinished(3));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const resume = async () => {
    if (await workout.resume()) router.push('/workout/log');
  };

  const discardActive = () => {
    if (!activeSession) return;
    Alert.alert('Discard workout?', 'The unfinished workout and its sets will be removed.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          const repos = await getRepos();
          await repos.sessions.discardSession(activeSession.id);
          workout.clear();
          await reload();
        },
      },
    ]);
  };

  const repeatLast = async () => {
    try {
      if (await workout.repeatLast()) {
        router.push('/workout/log');
      } else {
        Alert.alert('No previous workout', 'Finish a workout first, then repeat it in one tap.');
      }
    } catch (error) {
      if (error instanceof ActiveSessionExistsError) {
        Alert.alert('Workout in progress', 'Resume or discard it first.');
      } else {
        throw error;
      }
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {staleNotice ? (
        <Pressable style={styles.notice} onPress={dismissNotice}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.noticeText}>{staleNotice}</Text>
          <Ionicons name="close" size={16} color={colors.subtle} />
        </Pressable>
      ) : null}

      {activeSession ? (
        <View style={styles.resumeCard}>
          <Text style={styles.resumeTitle}>Workout in progress</Text>
          <Text style={styles.resumeSubtitle}>
            Started at {formatLocalTime(activeSession.startedAt)}
          </Text>
          <View style={styles.resumeButtons}>
            <AppButton label="Resume" onPress={resume} style={styles.resumeButton} />
            <AppButton label="Discard" variant="danger" onPress={discardActive} />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <AppButton label="Start workout" onPress={() => router.push('/workout/new')} />
          <AppButton label="Repeat last workout" variant="secondary" onPress={repeatLast} />
        </View>
      )}

      <Text style={styles.sectionTitle}>Recent sessions</Text>
      {recent.length === 0 ? (
        <EmptyState
          title="Nothing logged yet"
          hint="Your finished workouts will show up here."
        />
      ) : (
        recent.map((summary) => (
          <SessionCard
            key={summary.id}
            summary={summary}
            onPress={() => router.push(`/session/${summary.id}`)}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    padding: 12,
  },
  noticeText: { flex: 1, color: colors.text, fontSize: 13 },
  actions: { gap: 10 },
  resumeCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 16,
    gap: 6,
  },
  resumeTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  resumeSubtitle: { fontSize: 13, color: colors.subtle },
  resumeButtons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  resumeButton: { flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 8 },
});
