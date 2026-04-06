export type SettingsTab = 'general' | 'appearance' | 'themes' | 'keyboard' | 'distribution';

export const SETTINGS_TABS: SettingsTab[] = [
  'general',
  'appearance',
  'themes',
  'keyboard',
  'distribution',
];

export const SETTINGS_TAB_LABELS: Record<SettingsTab, string> = {
  general: 'General',
  appearance: 'Appearance',
  themes: 'Themes',
  keyboard: 'Keyboard',
  distribution: 'Distribution',
};