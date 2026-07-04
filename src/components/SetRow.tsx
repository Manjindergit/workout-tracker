import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ActiveSet } from '../stores/activeWorkout';
import { colors, TAP_TARGET } from '../theme';
import { displayToKg, kgToDisplay, parseNumericInput, type Unit } from '../utils/units';

interface SetRowProps {
  set: ActiveSet;
  unit: Unit;
  /** Weight stepper increment, in display units. */
  weightStep: number;
  isBodyweight: boolean;
  onValues: (weightKg: number, reps: number) => void;
  onToggle: () => void;
  onRemove: () => void;
}

/**
 * Text inputs own their local strings (so "82." survives while typing); steppers and
 * parsing funnel every change through onValues, which is the store's debounced flush.
 */
export function SetRow({
  set,
  unit,
  weightStep,
  isBodyweight,
  onValues,
  onToggle,
  onRemove,
}: SetRowProps) {
  const [weightText, setWeightText] = useState(() => {
    const display = kgToDisplay(set.weightKg, unit);
    return display > 0 ? String(display) : '';
  });
  const [repsText, setRepsText] = useState(() => (set.reps > 0 ? String(set.reps) : ''));

  const emit = (nextWeightText: string, nextRepsText: string) => {
    onValues(displayToKg(parseNumericInput(nextWeightText), unit), Math.round(parseNumericInput(nextRepsText)));
  };

  const stepWeight = (delta: number) => {
    const next = Math.max(0, parseNumericInput(weightText) + delta);
    const text = next > 0 ? String(Math.round(next * 100) / 100) : '';
    setWeightText(text);
    emit(text, repsText);
  };

  const stepReps = (delta: number) => {
    const next = Math.max(0, Math.round(parseNumericInput(repsText)) + delta);
    const text = next > 0 ? String(next) : '';
    setRepsText(text);
    emit(weightText, text);
  };

  return (
    <View style={[styles.row, set.completed && styles.completedRow]}>
      <Text style={styles.position}>{set.position}</Text>

      <View style={styles.field}>
        <StepButton icon="remove" onPress={() => stepWeight(-weightStep)} />
        <TextInput
          style={styles.input}
          value={weightText}
          onChangeText={(text) => {
            setWeightText(text);
            emit(text, repsText);
          }}
          keyboardType="decimal-pad"
          placeholder={isBodyweight ? 'BW+' : '0'}
          placeholderTextColor={colors.subtle}
          selectTextOnFocus
        />
        <StepButton icon="add" onPress={() => stepWeight(weightStep)} />
      </View>
      <Text style={styles.unitLabel}>{unit}</Text>

      <View style={styles.field}>
        <StepButton icon="remove" onPress={() => stepReps(-1)} />
        <TextInput
          style={styles.input}
          value={repsText}
          onChangeText={(text) => {
            setRepsText(text);
            emit(weightText, text);
          }}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.subtle}
          selectTextOnFocus
        />
        <StepButton icon="add" onPress={() => stepReps(1)} />
      </View>
      <Text style={styles.unitLabel}>reps</Text>

      <Pressable
        onPress={onToggle}
        style={[styles.check, set.completed && styles.checkDone]}
        hitSlop={6}
      >
        <Ionicons name="checkmark" size={22} color={set.completed ? '#fff' : colors.subtle} />
      </Pressable>

      <Pressable onPress={onRemove} hitSlop={10} style={styles.remove}>
        <Ionicons name="close" size={16} color={colors.subtle} />
      </Pressable>
    </View>
  );
}

function StepButton({ icon, onPress }: { icon: 'add' | 'remove'; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.step} hitSlop={4}>
      <Ionicons name={icon} size={16} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 4,
  },
  completedRow: {
    backgroundColor: colors.successSoft,
    borderRadius: 10,
  },
  position: { width: 18, textAlign: 'center', color: colors.subtle, fontWeight: '600' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    flex: 1,
  },
  input: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    paddingVertical: 8,
    minHeight: 42,
  },
  step: {
    width: 30,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitLabel: { fontSize: 11, color: colors.subtle, width: 26 },
  check: {
    width: TAP_TARGET - 6,
    height: TAP_TARGET - 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  checkDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  remove: { padding: 2 },
});
