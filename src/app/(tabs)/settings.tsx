import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { Chip } from '../../components/Chip';
import { getRepos } from '../../db/appDb';
import { useSettingsStore } from '../../stores/settingsStore';
import { colors } from '../../theme';
import { createBackup, parseBackup, restoreBackup, BackupError } from '../../utils/export/backup';
import { shareAsFile } from '../../utils/export/deliver';
import { DEFAULT_TEMPLATES, getTemplateText } from '../../utils/export/templates';

const INCREMENTS_KG = [1.25, 2.5, 5] as const;

export default function SettingsScreen() {
  const unit = useSettingsStore((s) => s.unit);
  const setUnit = useSettingsStore((s) => s.setUnit);
  const incrementKg = useSettingsStore((s) => s.weightIncrementKg);
  const setIncrementKg = useSettingsStore((s) => s.setWeightIncrementKg);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const openTemplate = useCallback(async (key: string) => {
    const repos = await getRepos();
    setDraft(await getTemplateText(repos.settings, key));
    setEditingKey(key);
  }, []);

  const saveTemplate = async () => {
    if (!editingKey) return;
    const repos = await getRepos();
    await repos.settings.set(editingKey, draft.trim());
    setEditingKey(null);
  };

  const resetTemplate = async () => {
    if (!editingKey) return;
    const repos = await getRepos();
    await repos.settings.set(editingKey, '');
    setEditingKey(null);
  };

  const backupNow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const repos = await getRepos();
      const backup = await createBackup(repos.db);
      const date = backup.exportedAt.slice(0, 10);
      await shareAsFile(
        JSON.stringify(backup),
        `workout-backup-${date}.json`,
        'application/json'
      );
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (busy) return;
    const picked = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
    const asset = picked.assets?.[0];
    if (!asset) return;

    setBusy(true);
    try {
      const content = await new File(asset.uri).text();
      const backup = parseBackup(content);
      Alert.alert(
        'Restore backup?',
        `From ${backup.exportedAt.slice(0, 10)}. Existing data is kept; missing records are added.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            onPress: async () => {
              const repos = await getRepos();
              const inserted = await restoreBackup(repos.db, backup);
              Alert.alert('Restore complete', `${inserted} records added.`);
            },
          },
        ]
      );
    } catch (error) {
      if (error instanceof BackupError) {
        Alert.alert('Cannot restore', error.message);
      } else {
        throw error;
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Units</Text>
      <View style={styles.chips}>
        <Chip label="Kilograms" selected={unit === 'kg'} onPress={() => void setUnit('kg')} />
        <Chip label="Pounds" selected={unit === 'lb'} onPress={() => void setUnit('lb')} />
      </View>
      <Text style={styles.hint}>Weights are stored in kg and converted for display.</Text>

      <Text style={styles.sectionTitle}>Weight stepper increment</Text>
      <View style={styles.chips}>
        {INCREMENTS_KG.map((step) => (
          <Chip
            key={step}
            label={`${step} kg`}
            selected={incrementKg === step}
            onPress={() => void setIncrementKg(step)}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>AI prompt templates</Text>
      {DEFAULT_TEMPLATES.map((template) => (
        <View key={template.key} style={styles.templateCard}>
          <View style={styles.templateHeader}>
            <Text style={styles.templateName}>{template.name}</Text>
            {editingKey !== template.key ? (
              <AppButton
                label="Edit"
                variant="secondary"
                onPress={() => void openTemplate(template.key)}
              />
            ) : null}
          </View>
          {editingKey === template.key ? (
            <View style={styles.editor}>
              <TextInput
                style={styles.templateInput}
                value={draft}
                onChangeText={setDraft}
                multiline
                textAlignVertical="top"
              />
              <View style={styles.editorButtons}>
                <AppButton label="Save" onPress={() => void saveTemplate()} style={styles.grow} />
                <AppButton label="Reset to default" variant="secondary" onPress={() => void resetTemplate()} />
              </View>
            </View>
          ) : null}
        </View>
      ))}

      <Text style={styles.sectionTitle}>Data</Text>
      <View style={styles.actions}>
        <AppButton label="Back up now (share JSON)" onPress={() => void backupNow()} disabled={busy} />
        <AppButton
          label="Restore from backup"
          variant="secondary"
          onPress={() => void restore()}
          disabled={busy}
        />
      </View>
      <Text style={styles.hint}>
        This app is offline-only — the backup file is the only copy of your data outside this
        phone. Share it to Drive or email yourself one regularly.
      </Text>

      <Text style={styles.about}>
        Workout Tracker v{Constants.expoConfig?.version ?? '1.0.0'} · data never leaves your device
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 18, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: { fontSize: 12, color: colors.subtle, marginTop: 4 },
  templateCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  templateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  templateName: { fontSize: 14, fontWeight: '600', color: colors.text },
  editor: { marginTop: 10, gap: 10 },
  templateInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    minHeight: 140,
    fontSize: 13,
    color: colors.text,
  },
  editorButtons: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
  actions: { gap: 10 },
  about: { fontSize: 12, color: colors.subtle, textAlign: 'center', marginTop: 28 },
});
