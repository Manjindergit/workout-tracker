import { SETTINGS_KEYS, type SettingsRepo } from '../../db/repositories/settingsRepo';
import { MARKDOWN_LEGEND } from './markdown';

export interface PromptTemplate {
  key: string;
  name: string;
  text: string;
}

/**
 * Shipped defaults, each ending with the format legend — that one line measurably
 * improves how models parse the data. User edits are stored in the settings table
 * under the same key; empty/unset falls back to these.
 */
export const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    key: SETTINGS_KEYS.promptTemplateCoach,
    name: 'Coach review',
    text:
      'You are an experienced strength coach. Review my recent training below: analyze progression per exercise, ' +
      'flag plateaus or regressions, comment on volume balance across muscle groups, and give 3 concrete, ' +
      'prioritized recommendations.\n\n' +
      MARKDOWN_LEGEND,
  },
  {
    key: SETTINGS_KEYS.promptTemplatePlan,
    name: 'Plan next week',
    text:
      'You are an experienced strength coach. Based on my recent training below, write next week’s workout plan: ' +
      'concrete exercises, sets, reps, and loads (kg), progressing sensibly from what I lifted. Keep the same ' +
      'general split and exercise selection unless something clearly needs to change.\n\n' +
      MARKDOWN_LEGEND,
  },
  {
    key: SETTINGS_KEYS.promptTemplatePlateau,
    name: 'Plateau diagnosis',
    text:
      'You are an experienced strength coach. The data below is the full history of one lift. Diagnose why progress ' +
      'has stalled: look at load/rep patterns, session frequency and gaps, and volume. Suggest a specific 4-week ' +
      'protocol to break the plateau.\n\n' +
      MARKDOWN_LEGEND,
  },
];

/** Resolve a template body: user override from settings, else the shipped default. */
export async function getTemplateText(settings: SettingsRepo, key: string): Promise<string> {
  const custom = await settings.get(key);
  if (custom && custom.trim().length > 0) return custom;
  return DEFAULT_TEMPLATES.find((t) => t.key === key)?.text ?? '';
}
