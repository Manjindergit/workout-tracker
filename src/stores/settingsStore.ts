import { create } from 'zustand';

import { getRepos } from '../db/appDb';
import { SETTINGS_KEYS } from '../db/repositories/settingsRepo';
import type { Unit } from '../utils/units';

interface SettingsState {
  unit: Unit;
  weightIncrementKg: number;
  loaded: boolean;
  load(): Promise<void>;
  setUnit(unit: Unit): Promise<void>;
  setWeightIncrementKg(increment: number): Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  unit: 'kg',
  weightIncrementKg: 2.5,
  loaded: false,

  async load() {
    const { settings } = await getRepos();
    const all = await settings.getAll();
    set({
      unit: (all[SETTINGS_KEYS.unit] as Unit) ?? 'kg',
      weightIncrementKg: Number(all[SETTINGS_KEYS.weightIncrementKg] ?? '2.5'),
      loaded: true,
    });
  },

  async setUnit(unit) {
    set({ unit });
    const { settings } = await getRepos();
    await settings.set(SETTINGS_KEYS.unit, unit);
  },

  async setWeightIncrementKg(increment) {
    set({ weightIncrementKg: increment });
    const { settings } = await getRepos();
    await settings.set(SETTINGS_KEYS.weightIncrementKg, String(increment));
  },
}));
