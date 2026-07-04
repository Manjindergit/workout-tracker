import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SectionList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Chip } from '../../components/Chip';
import { getRepos } from '../../db/appDb';
import { DuplicateExerciseNameError, type ExerciseWithGroup } from '../../db/repositories/exerciseRepo';
import { ActiveSessionExistsError } from '../../db/repositories/sessionRepo';
import { useActiveWorkoutStore } from '../../stores/activeWorkout';
import { colors, TAP_TARGET } from '../../theme';
import type { MuscleGroup } from '../../types/domain';

interface ExerciseSection {
  title: string;
  data: ExerciseWithGroup[];
}

export default function ExercisePickerScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const append = mode === 'append';
  const workout = useActiveWorkoutStore();

  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  const [exercises, setExercises] = useState<ExerciseWithGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [selectedExercises, setSelectedExercises] = useState<Set<string>>(new Set());
  const [customName, setCustomName] = useState('');
  const [customBodyweight, setCustomBodyweight] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const repos = await getRepos();
    setGroups(await repos.muscleGroups.listActive());
    setExercises(await repos.exercises.listActiveWithGroup());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const alreadyInWorkout = useMemo(
    () => new Set(workout.exercises.map((e) => e.exerciseId)),
    [workout.exercises]
  );

  const sections = useMemo<ExerciseSection[]>(() => {
    const visible = exercises.filter(
      (e) =>
        (selectedGroups.size === 0 || selectedGroups.has(e.primaryMuscleGroupId)) &&
        !(append && alreadyInWorkout.has(e.id))
    );
    const byGroup = new Map<string, ExerciseWithGroup[]>();
    for (const exercise of visible) {
      const list = byGroup.get(exercise.muscleGroupName) ?? [];
      list.push(exercise);
      byGroup.set(exercise.muscleGroupName, list);
    }
    return [...byGroup.entries()].map(([title, data]) => ({ title, data }));
  }, [exercises, selectedGroups, append, alreadyInWorkout]);

  const toggleGroup = (id: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExercise = (id: string) => {
    setSelectedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addCustom = async () => {
    const name = customName.trim();
    if (!name) return;
    if (selectedGroups.size !== 1) {
      Alert.alert('Pick one muscle group', 'Select exactly one chip so the exercise has a home.');
      return;
    }
    const [groupId] = [...selectedGroups];
    try {
      const repos = await getRepos();
      const created = await repos.exercises.createCustom(name, groupId, customBodyweight);
      setCustomName('');
      setCustomBodyweight(false);
      await reload();
      setSelectedExercises((prev) => new Set(prev).add(created.id));
    } catch (error) {
      if (error instanceof DuplicateExerciseNameError) {
        Alert.alert('Already exists', error.message);
      } else {
        throw error;
      }
    }
  };

  const confirm = async () => {
    if (selectedExercises.size === 0 || busy) return;
    setBusy(true);
    try {
      if (append) {
        await workout.addExercises([...selectedExercises]);
        router.back();
      } else {
        await workout.startNew([...selectedGroups], [...selectedExercises]);
        router.replace('/workout/log');
      }
    } catch (error) {
      setBusy(false);
      if (error instanceof ActiveSessionExistsError) {
        Alert.alert('Workout in progress', 'Resume or discard it from Home first.');
        return;
      }
      throw error;
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.chips}>
        {groups.map((group) => (
          <Chip
            key={group.id}
            label={group.name}
            selected={selectedGroups.has(group.id)}
            onPress={() => toggleGroup(group.id)}
          />
        ))}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const selected = selectedExercises.has(item.id);
          return (
            <Pressable
              onPress={() => toggleExercise(item.id)}
              style={[styles.exerciseRow, selected && styles.exerciseRowSelected]}
            >
              <View style={styles.exerciseText}>
                <Text style={styles.exerciseName}>{item.name}</Text>
                {item.isBodyweight ? <Text style={styles.bwTag}>bodyweight</Text> : null}
              </View>
              <Ionicons
                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={selected ? colors.primary : colors.border}
              />
            </Pressable>
          );
        }}
        ListFooterComponent={
          <View style={styles.customBox}>
            <Text style={styles.customTitle}>Add a custom exercise</Text>
            <TextInput
              style={styles.customInput}
              value={customName}
              onChangeText={setCustomName}
              placeholder="Exercise name"
              placeholderTextColor={colors.subtle}
            />
            <View style={styles.customRow}>
              <Text style={styles.customLabel}>Bodyweight</Text>
              <Switch value={customBodyweight} onValueChange={setCustomBodyweight} />
              <View style={styles.spacer} />
              <AppButton label="Add" variant="secondary" onPress={addCustom} />
            </View>
            <Text style={styles.customHint}>Select exactly one muscle-group chip above first.</Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <AppButton
          label={
            append
              ? `Add ${selectedExercises.size || ''} exercise${selectedExercises.size === 1 ? '' : 's'}`
              : `Start workout (${selectedExercises.size})`
          }
          onPress={confirm}
          disabled={selectedExercises.size === 0 || busy}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 12 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.subtle,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 6,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: TAP_TARGET,
    marginBottom: 6,
  },
  exerciseRowSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  exerciseText: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseName: { fontSize: 15, color: colors.text, fontWeight: '500' },
  bwTag: { fontSize: 11, color: colors.subtle },
  customBox: {
    marginTop: 18,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  customTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  customInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  customLabel: { fontSize: 14, color: colors.text },
  spacer: { flex: 1 },
  customHint: { fontSize: 12, color: colors.subtle },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
});
