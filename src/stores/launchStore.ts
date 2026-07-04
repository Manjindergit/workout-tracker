import { create } from 'zustand';

import { getRepos } from '../db/appDb';
import { formatLocalDate } from '../utils/dates';
import { useSettingsStore } from './settingsStore';

interface LaunchState {
  ready: boolean;
  /** One-time message about a stale session that was auto-closed/removed at launch. */
  staleNotice: string | null;
  init(): Promise<void>;
  dismissNotice(): void;
}

export const useLaunchStore = create<LaunchState>((set, get) => ({
  ready: false,
  staleNotice: null,

  async init() {
    if (get().ready) return;
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
  },

  dismissNotice() {
    set({ staleNotice: null });
  },
}));
