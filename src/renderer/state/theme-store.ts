import { signal } from '@preact/signals';
import type { ThemeDefinition } from '@shared/ipc-types';

export const activeTheme = signal<ThemeDefinition | null>(null);

let unsubscribe: (() => void) | null = null;

export async function initThemeStore(): Promise<void> {
  unsubscribe?.();
  unsubscribe = null;

  activeTheme.value = await window.quakeshell.theme.getActive();
  unsubscribe = window.quakeshell.theme.onChanged((theme) => {
    activeTheme.value = theme;
  });
}

export function getCurrentTheme(): ThemeDefinition | null {
  return activeTheme.peek();
}