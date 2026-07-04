import { create } from 'zustand';

import { getRepos } from '../db/appDb';
import { formatLocalDate } from '../utils/dates';
import { useSettingsStore } from './settingsStore';

interface LaunchState {
  ready: boolean;
  /** Set when db init fails — the root layout renders a retry screen from this. */
  initError: string | null;
  /** One-time message about a stale session that was auto-closed/removed at launch. */
  staleNotice: string | null;
  init(): Promise<void>;
  dismissNotice(): void;
}

export const useLaunchStore = create<LaunchState>((set, get) => ({
  ready: false,
  initError: null,
  staleNotice: null,

  async init() {
    if (get().ready) return;
    set({ initError: null });
    try {
      const repos = await getRepos();
      const result = await repos.sessions.closeStaleActiveSession();
      let staleNotice: string | null = null;
      if (result.outcome === 'closed') {
        staleNotice = `Your unfinished workout from ${formatLocalDate(result.session.startedAt)} was saved (${result.completedSets} sets).`;
      } else if (result.outcome === 'deleted') {
        staleNotice = 'An old empty workout was discarded.';
      }
      await useSettingsStore.getState().load();
      set({ ready: true, staleNotice });
    } catch (error) {
      console.warn('[launch] db init failed', error);
      set({ initError: error instanceof Error ? error.message : String(error) });
    }
  },

  dismissNotice() {
    set({ staleNotice: null });
  },
}));
