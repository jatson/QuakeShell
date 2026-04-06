// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const initialTheme = {
  id: 'tokyo-night',
  name: 'Tokyo Night',
  xtermTheme: {
    background: '#1a1b26',
    foreground: '#c0caf5',
    cursor: '#7aa2f7',
    cursorAccent: '#1a1b26',
    selectionBackground: '#28344a',
  },
  chromeTokens: {
    bgTerminal: '#1a1b26',
    bgChrome: '#13141c',
    fgPrimary: '#c0caf5',
    fgDimmed: '#565f89',
    accent: '#7aa2f7',
    border: '#2a2b3d',
  },
};

const changedTheme = {
  ...initialTheme,
  id: 'solarized-dark',
  name: 'Solarized Dark',
  xtermTheme: {
    ...initialTheme.xtermTheme,
    background: '#002b36',
    foreground: '#839496',
  },
  chromeTokens: {
    ...initialTheme.chromeTokens,
    bgTerminal: '#002b36',
    accent: '#268bd2',
  },
};

let onChangedCallback: ((theme: typeof initialTheme) => void) | null = null;

Object.defineProperty(window, 'quakeshell', {
  value: {
    theme: {
      getActive: vi.fn(async () => initialTheme),
      list: vi.fn(async () => [initialTheme]),
      set: vi.fn(),
      onChanged: vi.fn((callback: (theme: typeof initialTheme) => void) => {
        onChangedCallback = callback;
        return () => {
          onChangedCallback = null;
        };
      }),
    },
  },
  writable: true,
});

import { activeTheme, getCurrentTheme, initThemeStore } from './theme-store';

describe('renderer/state/theme-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeTheme.value = null;
    onChangedCallback = null;
  });

  it('loads the active theme during initialization', async () => {
    await initThemeStore();

    expect(window.quakeshell.theme.getActive).toHaveBeenCalledTimes(1);
    expect(activeTheme.value).toEqual(initialTheme);
  });

  it('updates activeTheme when theme:changed arrives', async () => {
    await initThemeStore();

    onChangedCallback?.(changedTheme);
    expect(activeTheme.value).toEqual(changedTheme);
  });

  it('returns the latest theme via getCurrentTheme()', async () => {
    await initThemeStore();
    onChangedCallback?.(changedTheme);

    expect(getCurrentTheme()).toEqual(changedTheme);
  });
});