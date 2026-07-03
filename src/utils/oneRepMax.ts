/**
 * Epley estimated 1RM. Matches the SQL in statsRepo (weight_kg * (1 + reps / 30.0)) —
 * keep the two in sync so in-app charts and exports never disagree.
 * Returns null when the formula is meaningless (bodyweight/zero entries).
 */
export function epley1Rm(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0) return null;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}
