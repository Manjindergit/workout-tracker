import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  hint?: string;
}

export function EmptyState({ icon = 'barbell-outline', title, hint }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={40} color={colors.subtle} />
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 32, gap: 8 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
  hint: { fontSize: 14, color: colors.subtle, textAlign: 'center' },
});
