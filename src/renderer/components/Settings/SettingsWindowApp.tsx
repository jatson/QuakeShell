import { useEffect } from 'preact/hooks';
import ThemeStyleInjector from '../ThemeStyleInjector';
import { initThemeStore } from '../../state/theme-store';
import { initConfigStore } from '../../state/config-store';
import SettingsPanel from './SettingsPanel';
import { openSettings, _reset } from '../../state/settings-store';
import { SETTINGS_TABS, type SettingsTab } from './SettingsTabs';

interface SettingsWindowAppProps {
  initialTab?: string | null;
}

function resolveInitialTab(tab: string | null | undefined): SettingsTab {
  return SETTINGS_TABS.includes((tab ?? '') as SettingsTab)
    ? (tab as SettingsTab)
    : 'general';
}

export default function SettingsWindowApp({ initialTab }: SettingsWindowAppProps) {
  useEffect(() => {
    void Promise.all([
      initConfigStore(),
      initThemeStore(),
    ]);

    openSettings(resolveInitialTab(initialTab));

    return () => {
      _reset();
    };
  }, [initialTab]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ThemeStyleInjector />
      <SettingsPanel standalone />
    </div>
  );
}