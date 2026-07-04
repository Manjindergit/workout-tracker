import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '../../components/EmptyState';
import { getRepos } from '../../db/appDb';
import type { TrackedExercise } from '../../db/repositories/statsRepo';
import { colors, TAP_TARGET } from '../../theme';

interface TrackedSection {
  title: string;
  data: TrackedExercise[];
}

export default function ProgressScreen() {
  const [tracked, setTracked] = useState<TrackedExercise[]>([]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const repos = await getRepos();
        setTracked(await repos.stats.listTrackedExercises());
      })();
    }, [])
  );

  const sections = useMemo<TrackedSection[]>(() => {
    const byGroup = new Map<string, TrackedExercise[]>();
    for (const exercise of tracked) {
      const list = byGroup.get(exercise.muscleGroupName) ?? [];
      list.push(exercise);
      byGroup.set(exercise.muscleGroupName, list);
    }
    return [...byGroup.entries()].map(([title, data]) => ({ title, data }));
  }, [tracked]);

  return (
    <View style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <EmptyState
            icon="trending-up-outline"
            title="No progress to chart yet"
            hint="Finish workouts with completed sets and each exercise's trend appears here."
          />
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.push(`/exercise/${item.id}`)}
          >
            <View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.sessionCount} session{item.sessionCount === 1 ? '' : 's'}
                {item.isBodyweight ? ' · bodyweight' : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.subtle,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: TAP_TARGET,
    marginBottom: 6,
  },
  pressed: { opacity: 0.8 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.subtle, marginTop: 2 },
});
