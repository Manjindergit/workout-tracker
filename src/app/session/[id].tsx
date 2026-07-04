import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Chip } from '../../components/Chip';
import { EmptyState } from '../../components/EmptyState';
import { getRepos } from '../../db/appDb';
import { deliverText } from '../../utils/export/deliver';
import { serializeSessionsMarkdown } from '../../utils/export/markdown';
import { useSettingsStore } from '../../stores/settingsStore';
import { colors } from '../../theme';
import type { SessionDetail } from '../../types/domain';
import { elapsedMs, formatLocalDate, formatLocalTime } from '../../utils/dates';
import { formatWeight } from '../../utils/units';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const unit = useSettingsStore((s) => s.unit);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const repos = await getRepos();
        const result = await repos.sessions.getSessionDetail(id);
        if (!cancelled) {
          setDetail(result);
          setLoaded(true);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [id])
  );

  if (!loaded) return <View style={styles.screen} />;
  if (!detail) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Session not found" />
      </View>
    );
  }

  const durationMin = detail.finishedAt
    ? Math.max(1, Math.round(elapsedMs(detail.startedAt, detail.finishedAt) / 60_000))
    : null;
  const groupNames = [...new Set(detail.exercises.map((e) => e.muscleGroupName))];

  // This session plus the two before it — the "what should I do next time?" paste.
  const copyForAi = async () => {
    const repos = await getRepos();
    const recent = await repos.sessions.listFinished(50);
    const index = recent.findIndex((s) => s.id === detail.id);
    const ids = (index >= 0 ? recent.slice(index, index + 3) : [detail]).map((s) => s.id);
    const details = (
      await Promise.all(ids.map((sessionId) => repos.sessions.getSessionDetail(sessionId)))
    ).filter((d): d is NonNullable<typeof d> => d !== null);
    const route = await deliverText(
      serializeSessionsMarkdown(details),
      'workout-session.md',
      'text/markdown'
    );
    if (route === 'clipboard') {
      Alert.alert('Copied', 'This session (plus the two before it) is on the clipboard.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.date}>{formatLocalDate(detail.startedAt)}</Text>
      <Text style={styles.meta}>
        {formatLocalTime(detail.startedAt)}
        {detail.finishedAt ? ` – ${formatLocalTime(detail.finishedAt)} · ${durationMin} min` : ' · in progress'}
      </Text>

      <View style={styles.chips}>
        {groupNames.map((name) => (
          <Chip key={name} label={name} />
        ))}
      </View>

      {detail.finishedAt ? (
        <AppButton
          label="Copy for AI"
          variant="secondary"
          onPress={() => void copyForAi()}
          style={styles.copyButton}
        />
      ) : null}

      {detail.exercises.length === 0 ? (
        <EmptyState title="No exercises in this session" />
      ) : (
        detail.exercises.map((exercise) => {
          const completedSets = exercise.sets.filter((s) => s.completed);
          return (
            <View key={exercise.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{exercise.exerciseName}</Text>
                <Text style={styles.cardSubtitle}>{exercise.muscleGroupName}</Text>
              </View>
              {completedSets.length === 0 ? (
                <Text style={styles.noSets}>No completed sets</Text>
              ) : (
                completedSets.map((set) => (
                  <View key={set.id} style={styles.setLine}>
                    <Text style={styles.setPosition}>{set.position}.</Text>
                    <Text style={styles.setText}>
                      {formatWeight(set.weightKg, unit, exercise.isBodyweight)} × {set.reps}
                    </Text>
                  </View>
                ))
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  date: { fontSize: 20, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.subtle, marginTop: 2, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  copyButton: { marginBottom: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardSubtitle: { fontSize: 12, color: colors.subtle },
  noSets: { fontSize: 13, color: colors.subtle, fontStyle: 'italic' },
  setLine: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  setPosition: { width: 20, color: colors.subtle, fontSize: 14 },
  setText: { fontSize: 14, color: colors.text, fontWeight: '500' },
});
