export type Unit = 'kg' | 'lb';

export const KG_PER_LB = 0.45359237;

/** Stored kg → display value in the user's unit, rounded to 2 decimals. */
export function kgToDisplay(weightKg: number, unit: Unit): number {
  const value = unit === 'kg' ? weightKg : weightKg / KG_PER_LB;
  return Math.round(value * 100) / 100;
}

/** User-entered value in their unit → stored kg (full precision). */
export function displayToKg(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

/** "82.5 kg" / "180 lb"; bodyweight sets render as "BW" / "BW+10kg". */
export function formatWeight(weightKg: number, unit: Unit, isBodyweight = false): string {
  if (isBodyweight) {
    return weightKg > 0 ? `BW+${trimZeros(kgToDisplay(weightKg, unit))}${unit}` : 'BW';
  }
  return `${trimZeros(kgToDisplay(weightKg, unit))} ${unit}`;
}

function trimZeros(n: number): string {
  return String(n);
}

/** Parse a weight/reps text input safely; empty or invalid → 0. Accepts comma decimals. */
export function parseNumericInput(text: string): number {
  const normalized = text.replace(',', '.').trim();
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
