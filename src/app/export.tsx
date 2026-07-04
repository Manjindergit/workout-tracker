import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { getRepos } from '../db/appDb';
import type { TrackedExercise } from '../db/repositories/statsRepo';
import { colors } from '../theme';
import type { SessionDetail } from '../types/domain';
import { deliverText, shareAsFile } from '../utils/export/deliver';
import {
  serializeExerciseHistoryMarkdown,
  serializeSessionsMarkdown,
} from '../utils/export/markdown';
import { DEFAULT_TEMPLATES, getTemplateText } from '../utils/export/templates';

type Mode = 'recent' | 'exercise';
const RECENT_COUNTS = [5, 10, 20] as const;

export default function ExportScreen() {
  const [mode, setMode] = useState<Mode>('recent');
  const [recentCount, setRecentCount] = useState<number>(10);
  const [tracked, setTracked] = useState<TrackedExercise[]>([]);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [templateKey, setTemplateKey] = useState<string | null>(DEFAULT_TEMPLATES[0].key);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const repos = await getRepos();
        setTracked(await repos.stats.listTrackedExercises());
      })();
    }, [])
  );

  const buildContent = async (): Promise<string | null> => {
    const repos = await getRepos();
    let body: string;

    if (mode === 'recent') {
      const summaries = await repos.sessions.listFinished(recentCount);
      if (summaries.length === 0) return null;
      const details = (
        await Promise.all(summaries.map((s) => repos.sessions.getSessionDetail(s.id)))
      ).filter((d): d is SessionDetail => d !== null);
      body = serializeSessionsMarkdown(details);
    } else {
      if (!exerciseId) return null;
      const exercise = await repos.exercises.getById(exerciseId);
      if (!exercise) return null;
      const history = await repos.stats.exerciseSetsHistory(exerciseId);
      if (history.length === 0) return null;
      body = serializeExerciseHistoryMarkdown(exercise.name, exercise.isBodyweight, history);
    }

    if (templateKey) {
      const template = await getTemplateText(repos.settings, templateKey);
      return `${template}\n\n---\n\n${body}`;
    }
    return body;
  };

  const run = async (route: 'auto' | 'file') => {
    if (busy) return;
    setBusy(true);
    try {
      const content = await buildContent();
      if (!content) {
        Alert.alert('Nothing to export', 'Finish some workouts first.');
        return;
      }
      const kb = Math.max(1, Math.round(content.length / 1024));
      const delivered =
        route === 'file'
          ? await shareAsFile(content, 'workout-export.md', 'text/markdown')
          : await deliverText(content, 'workout-export.md', 'text/markdown');
      if (delivered === 'clipboard') {
        Alert.alert('Copied', `~${kb} KB on the clipboard — paste it into your AI chat.`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>What to export</Text>
      <View style={styles.chips}>
        <Chip label="Recent sessions" selected={mode === 'recent'} onPress={() => setMode('recent')} />
        <Chip label="One exercise" selected={mode === 'exercise'} onPress={() => setMode('exercise')} />
      </View>

      {mode === 'recent' ? (
        <View style={styles.chips}>
          {RECENT_COUNTS.map((count) => (
            <Chip
              key={count}
              label={`Last ${count}`}
              selected={recentCount === count}
              onPress={() => setRecentCount(count)}
            />
          ))}
        </View>
      ) : tracked.length === 0 ? (
        <EmptyState title="No tracked exercises yet" hint="Finish a workout first." />
      ) : (
        <View style={styles.chips}>
          {tracked.map((exercise) => (
            <Chip
              key={exercise.id}
              label={exercise.name}
              selected={exerciseId === exercise.id}
              onPress={() => setExerciseId(exercise.id)}
            />
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Prompt template</Text>
      <View style={styles.chips}>
        <Chip label="None" selected={templateKey === null} onPress={() => setTemplateKey(null)} />
        {DEFAULT_TEMPLATES.map((template) => (
          <Chip
            key={template.key}
            label={template.name}
            selected={templateKey === template.key}
            onPress={() => setTemplateKey(template.key)}
          />
        ))}
      </View>
      <Text style={styles.hint}>
        Templates prepend coaching instructions and a data-format legend. Edit them in Settings.
      </Text>

      <View style={styles.actions}>
        <AppButton
          label="Copy for AI"
          onPress={() => void run('auto')}
          disabled={busy || (mode === 'exercise' && !exerciseId)}
        />
        <AppButton
          label="Share as file"
          variant="secondary"
          onPress={() => void run('file')}
          disabled={busy || (mode === 'exercise' && !exerciseId)}
        />
      </View>
      <Text style={styles.hint}>
        Large exports open the share sheet automatically instead of the clipboard.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 12, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: { fontSize: 12, color: colors.subtle, marginTop: 6 },
  actions: { gap: 10, marginTop: 20 },
});
