import Ionicons from '@expo/vector-icons/Ionicons';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { EmptyState } from '../../components/EmptyState';
import { SetRow } from '../../components/SetRow';
import { useActiveWorkoutStore, type ActiveExercise } from '../../stores/activeWorkout';
import { useSettingsStore } from '../../stores/settingsStore';
import { colors } from '../../theme';
import { formatLocalTime } from '../../utils/dates';
import { stepForUnit } from '../../utils/units';

export default function LogScreen() {
  useKeepAwake(); // the phone must not lock between sets

  const workout = useActiveWorkoutStore();
  const unit = useSettingsStore((s) => s.unit);
  const incrementKg = useSettingsStore((s) => s.weightIncrementKg);
  const [elapsedMin, setElapsedMin] = useState(0);

  // Elapsed-time header, refreshed every 30s (timer callbacks keep render pure).
  const startedAt = workout.startedAt;
  useEffect(() => {
    if (!startedAt) return;
    const compute = () =>
      setElapsedMin(Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 60_000)));
    const timeout = setTimeout(compute, 0);
    const interval = setInterval(compute, 30_000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [startedAt]);

  useEffect(() => {
    if (!workout.sessionId) {
      void workout.resume().then((ok) => {
        if (!ok) router.replace('/(tabs)');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout.sessionId]);

  if (!workout.sessionId) return null;

  const completedCount = workout.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.completed).length,
    0
  );
  const draftCount = workout.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => !s.completed).length,
    0
  );

  const finish = () => {
    if (completedCount === 0) {
      Alert.alert('No sets completed', 'Nothing to save yet — discard this workout?', [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Discard workout',
          style: 'destructive',
          onPress: async () => {
            try {
              await workout.discard();
              router.replace('/(tabs)');
            } catch {
              Alert.alert('Could not discard', 'Something went wrong — try again.');
            }
          },
        },
      ]);
      return;
    }
    const draftNote = draftCount > 0 ? ` ${draftCount} unchecked sets will be removed.` : '';
    Alert.alert(
      'Finish workout?',
      `${workout.exercises.length} exercises, ${completedCount} completed sets, ${elapsedMin} min.${draftNote}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish',
          onPress: async () => {
            try {
              const sessionId = await workout.finish();
              if (sessionId) router.replace(`/session/${sessionId}`);
            } catch {
              Alert.alert('Could not finish', 'Something went wrong saving — try again.');
            }
          },
        },
      ]
    );
  };

  const discard = () => {
    Alert.alert('Discard workout?', 'All sets from this session will be removed.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          try {
            await workout.discard();
            router.replace('/(tabs)');
          } catch {
            Alert.alert('Could not discard', 'Something went wrong — try again.');
          }
        },
      },
    ]);
  };

  const removeExercise = (exercise: ActiveExercise) => {
    const done = exercise.sets.filter((s) => s.completed).length;
    if (done === 0) {
      void workout.removeExercise(exercise.sessionExerciseId);
      return;
    }
    Alert.alert(
      `Remove ${exercise.name}?`,
      `${done} completed set${done === 1 ? '' : 's'} will be deleted with it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void workout.removeExercise(exercise.sessionExerciseId),
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          Started {workout.startedAt ? formatLocalTime(workout.startedAt) : ''} · {elapsedMin} min
          · {completedCount} sets done
        </Text>
      </View>

      <FlatList
        data={workout.exercises}
        keyExtractor={(e) => e.sessionExerciseId}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState title="No exercises yet" hint="Add exercises to start logging." />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleBox}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSubtitle}>{item.muscleGroupName}</Text>
              </View>
              <Pressable onPress={() => removeExercise(item)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.subtle} />
              </Pressable>
            </View>
            {item.lastLabel ? <Text style={styles.lastLabel}>{item.lastLabel}</Text> : null}
            {item.sets.map((set) => (
              <SetRow
                key={set.id}
                set={set}
                unit={unit}
                weightStep={stepForUnit(incrementKg, unit)}
                isBodyweight={item.isBodyweight}
                onValues={(weightKg, reps) =>
                  workout.setSetValues(item.sessionExerciseId, set.id, weightKg, reps)
                }
                onToggle={() => void workout.toggleSet(item.sessionExerciseId, set.id)}
                onRemove={() => void workout.removeSet(item.sessionExerciseId, set.id)}
              />
            ))}
            <Pressable style={styles.addSet} onPress={() => void workout.addSet(item.sessionExerciseId)}>
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={styles.addSetText}>Add set</Text>
            </Pressable>
          </View>
        )}
        ListFooterComponent={
          <Pressable
            style={styles.addExercise}
            onPress={() => router.push('/workout/new?mode=append')}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.addExerciseText}>Add exercises</Text>
          </Pressable>
        }
      />

      <View style={styles.footer}>
        <AppButton label="Finish workout" onPress={finish} style={styles.finishButton} />
        <AppButton label="Discard" variant="danger" onPress={discard} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: { fontSize: 13, color: colors.subtle },
  listContent: { padding: 16, paddingBottom: 24 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitleBox: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardSubtitle: { fontSize: 12, color: colors.subtle },
  lastLabel: { fontSize: 12, color: colors.primary },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  addSetText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  addExercise: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  addExerciseText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  finishButton: { flex: 1 },
});
