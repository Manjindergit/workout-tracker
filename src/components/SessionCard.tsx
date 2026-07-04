import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SessionSummary } from '../types/domain';
import { formatLocalDate } from '../utils/dates';
import { colors } from '../theme';

interface SessionCardProps {
  summary: SessionSummary;
  onPress: () => void;
}

export function SessionCard({ summary, onPress }: SessionCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.row}>
        <Text style={styles.date}>{formatLocalDate(summary.startedAt)}</Text>
        <Text style={styles.counts}>
          {summary.exerciseCount} exercises · {summary.completedSetCount} sets
        </Text>
      </View>
      <Text style={styles.groups} numberOfLines={1}>
        {summary.muscleGroups.join(' · ') || '—'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  pressed: { opacity: 0.8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 15, fontWeight: '600', color: colors.text },
  counts: { fontSize: 13, color: colors.subtle },
  groups: { fontSize: 13, color: colors.primary, fontWeight: '500' },
});
