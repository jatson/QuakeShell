import { signal } from '@preact/signals';
import type { SettingsTab } from '../components/Settings/SettingsTabs';

export const isSettingsOpen = signal(false);
export const activeSettingsTab = signal<SettingsTab>('general');

let lastFocusedElement: HTMLElement | null = null;

export function openSettings(tab: SettingsTab = 'general'): void {
  if (!isSettingsOpen.value && document.activeElement instanceof HTMLElement) {
    lastFocusedElement = document.activeElement;
  }

  activeSettingsTab.value = tab;
  isSettingsOpen.value = true;
}

export function closeSettings(): void {
  isSettingsOpen.value = false;

  const focusTarget = lastFocusedElement;
  lastFocusedElement = null;

  queueMicrotask(() => {
    if (focusTarget && focusTarget.isConnected) {
      focusTarget.focus();
      return;
    }

    const fallbackTarget = document.querySelector<HTMLElement>('.xterm-helper-textarea, .xterm textarea');
    fallbackTarget?.focus();
  });
}

export function _reset(): void {
  isSettingsOpen.value = false;
  activeSettingsTab.value = 'general';
  lastFocusedElement = null;
}