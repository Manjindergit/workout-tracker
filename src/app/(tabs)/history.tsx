import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '../../components/EmptyState';
import { SessionCard } from '../../components/SessionCard';
import { getRepos } from '../../db/appDb';
import { colors } from '../../theme';
import type { SessionSummary } from '../../types/domain';
import { formatLocalDate } from '../../utils/dates';

const PAGE_SIZE = 50;

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (offset = 0) => {
    const repos = await getRepos();
    const page = await repos.sessions.listFinished(PAGE_SIZE + 1, offset);
    const trimmed = page.slice(0, PAGE_SIZE);
    setHasMore(page.length > PAGE_SIZE);
    setSessions((prev) => (offset === 0 ? trimmed : [...prev, ...trimmed]));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(0);
    }, [load])
  );

  const confirmDelete = (summary: SessionSummary) => {
    Alert.alert(
      'Delete session?',
      `${formatLocalDate(summary.startedAt)} — ${summary.completedSetCount} sets will be removed permanently.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const repos = await getRepos();
            await repos.sessions.discardSession(summary.id);
            await load(0);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          sessions.length > 0 ? (
            <Text style={styles.hint}>Tap a session to view it · long-press to delete</Text>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="No finished workouts yet"
            hint="Sessions appear here after you tap Finish."
          />
        }
        renderItem={({ item }) => (
          <SessionCard
            summary={item}
            onPress={() => router.push(`/session/${item.id}`)}
            onLongPress={() => confirmDelete(item)}
          />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (hasMore) void load(sessions.length);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  hint: { fontSize: 12, color: colors.subtle, marginBottom: 10, textAlign: 'center' },
});
