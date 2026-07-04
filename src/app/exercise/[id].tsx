import { matchFont } from '@shopify/react-native-skia';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CartesianChart, Line, Scatter } from 'victory-native';

import { EmptyState } from '../../components/EmptyState';
import { getRepos } from '../../db/appDb';
import type { SeriesPoint } from '../../db/repositories/statsRepo';
import { useSettingsStore } from '../../stores/settingsStore';
import { colors } from '../../theme';
import type { Exercise } from '../../types/domain';
import { formatLocalDate } from '../../utils/dates';
import { kgToDisplay } from '../../utils/units';

// System font via Skia — no bundled TTF needed for axis labels.
const axisFont = matchFont({
  fontFamily: Platform.select({ android: 'sans-serif', default: 'Helvetica' }),
  fontSize: 11,
});

export default function ExerciseProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [loaded, setLoaded] = useState(false);
  const unit = useSettingsStore((s) => s.unit);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const repos = await getRepos();
        const found = await repos.exercises.getById(id);
        const points = found
          ? found.isBodyweight
            ? await repos.stats.repsSeries(id)
            : await repos.stats.e1rmSeries(id)
          : [];
        if (!cancelled) {
          setExercise(found);
          setSeries(points);
          setLoaded(true);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [id])
  );

  if (!loaded) return <View style={styles.screen} />;
  if (!exercise) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Exercise not found" />
      </View>
    );
  }

  const isBodyweight = exercise.isBodyweight;
  const metricLabel = isBodyweight ? 'Best reps per session' : `Estimated 1RM (${unit})`;
  const toDisplay = (value: number) => (isBodyweight ? value : kgToDisplay(value, unit));

  const chartData = series.map((p) => ({
    x: new Date(p.startedAt).getTime(),
    y: Math.round(toDisplay(p.value) * 10) / 10,
  }));
  const latest = chartData.at(-1);
  const best = chartData.reduce((max, p) => Math.max(max, p.y), 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: exercise.name }} />

      <View style={styles.statsRow}>
        <StatBox label={isBodyweight ? 'Latest best reps' : `Latest e1RM (${unit})`} value={latest?.y ?? '—'} />
        <StatBox label={isBodyweight ? 'All-time reps' : `Best e1RM (${unit})`} value={series.length ? best : '—'} />
        <StatBox label="Sessions" value={series.length} />
      </View>

      {series.length < 2 ? (
        <EmptyState
          icon="trending-up-outline"
          title="Not enough data for a trend"
          hint="Finish this exercise in at least two sessions to draw the line."
        />
      ) : (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>{metricLabel}</Text>
          <View style={styles.chart}>
            <CartesianChart
              data={chartData}
              xKey="x"
              yKeys={['y']}
              domainPadding={{ left: 24, right: 24, top: 24, bottom: 12 }}
              axisOptions={{
                font: axisFont,
                labelColor: colors.subtle,
                lineColor: colors.border,
                formatXLabel: (ms) => {
                  const d = new Date(ms);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                },
              }}
            >
              {({ points }) => (
                <>
                  <Line
                    points={points.y}
                    color={colors.primary}
                    strokeWidth={3}
                    curveType="monotoneX"
                  />
                  <Scatter points={points.y} radius={4} style="fill" color={colors.primary} />
                </>
              )}
            </CartesianChart>
          </View>
        </View>
      )}

      {series.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.chartTitle}>Per session</Text>
          {[...series].reverse().map((point) => (
            <View key={point.sessionId} style={styles.pointRow}>
              <Text style={styles.pointDate}>{formatLocalDate(point.startedAt)}</Text>
              <Text style={styles.pointValue}>
                {Math.round(toDisplay(point.value) * 10) / 10}
                {isBodyweight ? ' reps' : ` ${unit}`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 11, color: colors.subtle, textAlign: 'center' },
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  chartTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
  chart: { height: 260 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  pointRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pointDate: { fontSize: 13, color: colors.subtle },
  pointValue: { fontSize: 14, fontWeight: '600', color: colors.text },
});
