import { useEffect, useState } from 'preact/hooks';
import type { ThemeInfo } from '@shared/ipc-types';
import ThemeCard from './ThemeCard';
import styles from './ThemesSettings.module.css';

export default function ThemesSettings() {
  const [themes, setThemes] = useState<ThemeInfo[]>([]);
  const [activeThemeId, setActiveThemeId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      window.quakeshell.theme.list(),
      window.quakeshell.theme.getCurrent(),
    ]).then(([nextThemes, currentThemeId]) => {
      if (cancelled) {
        return;
      }

      setThemes(nextThemes);
      setActiveThemeId(currentThemeId);
      setLoadError('');
    }).catch((error: unknown) => {
      if (!cancelled) {
        setLoadError(error instanceof Error ? error.message : 'Failed to load themes');
      }
    }).finally(() => {
      if (!cancelled) {
        setIsLoading(false);
      }
    });

    const unsubscribe = window.quakeshell.theme.onChanged((theme) => {
      if (!cancelled) {
        setActiveThemeId(theme.id);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const applyTheme = async (themeId: string) => {
    const previousThemeId = activeThemeId;
    setActiveThemeId(themeId);

    try {
      await window.quakeshell.theme.set(themeId);
    } catch (error) {
      setActiveThemeId(previousThemeId);
      setLoadError(error instanceof Error ? error.message : 'Failed to apply theme');
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingGrid} role="status" aria-label="Loading themes">
        <span>Loading themes…</span>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={`theme-skeleton-${index}`} className={styles.skeletonCard} />
        ))}
      </div>
    );
  }

  if (loadError) {
    return <div className={styles.error}>{loadError}</div>;
  }

  return (
    <div className={styles.grid} role="radiogroup" aria-label="Theme selection">
      {themes.map((theme) => (
        <ThemeCard
          key={theme.id}
          theme={theme}
          isActive={theme.id === activeThemeId}
          onClick={() => { void applyTheme(theme.id); }}
        />
      ))}
    </div>
  );
}