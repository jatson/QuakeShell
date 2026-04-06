import { signal } from '@preact/signals';
import type { Config } from '@shared/config-schema';

// Config signals — one per config key, initialized with defaults
export const opacity = signal(0.85);
export const animationSpeed = signal(200);
export const fontSize = signal(14);
export const fontFamily = signal('Cascadia Code, Consolas, Courier New, monospace');
export const lineHeight = signal(1.2);
export const hotkey = signal('Ctrl+Shift+Q');
export const defaultShell = signal('powershell');
export const focusFade = signal(true);
export const dropHeight = signal(30);
export const autostart = signal(true);
export const firstRun = signal(false);

const signalMap: Partial<Record<keyof Config, ReturnType<typeof signal>>> = {
  opacity,
  animationSpeed,
  fontSize,
  fontFamily,
  lineHeight,
  hotkey,
  defaultShell,
  focusFade,
  dropHeight,
  autostart,
  firstRun,
};

let unsubscribe: (() => void) | null = null;

// Populate signals with current config values and subscribe to live changes
export async function initConfigStore(): Promise<void> {
  const config = await window.quakeshell.config.getAll();
  for (const key of Object.keys(config) as (keyof Config)[]) {
    const s = signalMap[key];
    if (s) {
      s.value = config[key] as never;
    }
  }

  // Listen for config:changed events from main process
  unsubscribe = window.quakeshell.config.onConfigChange((payload) => {
    const key = payload.key as keyof Config;
    const s = signalMap[key];
    if (s) {
      s.value = payload.value as never;
    }
  });
}

// Cleanup on unload
window.addEventListener('unload', () => {
  unsubscribe?.();
});
