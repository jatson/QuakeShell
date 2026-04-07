import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHANNELS } from '../shared/channels';

const electronMocks = vi.hoisted(() => {
  const webContentsSend = vi.fn();
  return {
    app: {
      isPackaged: false,
      getPath: vi.fn(() => ''),
    },
    BrowserWindow: {
      getAllWindows: vi.fn(() => [{ webContents: { send: webContentsSend } }]),
    },
    webContentsSend,
  };
});

const logger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('electron', () => ({
  app: electronMocks.app,
  BrowserWindow: electronMocks.BrowserWindow,
}));

vi.mock('electron-log/main', () => ({
  default: {
    scope: vi.fn(() => logger),
  },
}));

import { ThemeEngine } from './theme-engine';

const communityTheme = {
  id: 'custom-blue',
  name: 'Custom Blue',
  xtermTheme: {
    background: '#101820',
    foreground: '#d0e7ff',
    cursor: '#5dade2',
    cursorAccent: '#101820',
    selectionBackground: '#23405c',
    black: '#101820',
    red: '#f7768e',
    green: '#9ece6a',
    yellow: '#e0af68',
    blue: '#5dade2',
    magenta: '#bb9af7',
    cyan: '#7dcfff',
    white: '#d0e7ff',
    brightBlack: '#2f4155',
    brightRed: '#f7768e',
    brightGreen: '#9ece6a',
    brightYellow: '#e0af68',
    brightBlue: '#5dade2',
    brightMagenta: '#bb9af7',
    brightCyan: '#7dcfff',
    brightWhite: '#eaf4ff',
  },
  chromeTokens: {
    bgTerminal: '#101820',
    bgChrome: '#0a1016',
    fgPrimary: '#d0e7ff',
    fgDimmed: '#5a7086',
    accent: '#5dade2',
    border: '#23405c',
  },
};

const bundledCommunityThemes = [
  communityTheme,
  {
    id: 'custom-mint',
    name: 'Custom Mint',
    xtermTheme: {
      ...communityTheme.xtermTheme,
      background: '#0f1411',
      foreground: '#d9f7e4',
      cursor: '#5bc38d',
      cursorAccent: '#0f1411',
      selectionBackground: '#1b2f24',
      blue: '#5bc38d',
      brightBlue: '#84d9aa',
      white: '#d9f7e4',
      brightWhite: '#f1fff6',
    },
    chromeTokens: {
      bgTerminal: '#0f1411',
      bgChrome: '#09100c',
      fgPrimary: '#d9f7e4',
      fgDimmed: '#6b8d79',
      accent: '#5bc38d',
      border: '#1f3d2d',
    },
  },
];

class TestThemeEngine extends ThemeEngine {
  readonly watchUserThemesDirSpy = vi.fn();

  constructor(
    private readonly bundledDir: string,
    private readonly userDir: string,
  ) {
    super();
  }

  override getThemesDir(): string {
    return this.bundledDir;
  }

  override getUserThemesDir(): string {
    return this.userDir;
  }

  override watchUserThemesDir(): void {
    this.watchUserThemesDirSpy();
  }
}

function createConfigStore(themeId: string) {
  let changeListener: ((key: string, value: unknown, oldValue: unknown) => void) | null = null;

  return {
    store: {
      get: vi.fn(() => themeId),
      onDidChange: vi.fn((callback: (key: string, value: unknown, oldValue: unknown) => void) => {
        changeListener = callback;
        return () => {
          changeListener = null;
        };
      }),
    },
    emitThemeChange(newThemeId: string, oldThemeId: string) {
      changeListener?.('theme', newThemeId, oldThemeId);
    },
  };
}

describe('main/theme-engine', () => {
  let userThemesDir: string;
  let engine: TestThemeEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    userThemesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quakeshell-themes-'));
    engine = new TestThemeEngine(path.resolve(process.cwd(), 'themes'), userThemesDir);
  });

  afterEach(() => {
    engine.destroy();
    vi.useRealTimers();
    fs.rmSync(userThemesDir, { recursive: true, force: true });
  });

  it('loads the core bundled themes and shipped theme packs in development mode', () => {
    const themes = engine.loadBundledThemes();

    expect(themes).toHaveLength(15);
    expect(themes.slice(0, 3).map((theme) => theme.id).sort()).toEqual(['retro-green', 'solarized-dark', 'tokyo-night']);
    expect(themes.some((theme) => theme.id === 'midnight-mint')).toBe(true);
    expect(themes.some((theme) => theme.id === 'paper-mint')).toBe(true);
  });

  it('activates a shipped theme pack theme when configured', () => {
    const config = createConfigStore('midnight-mint');

    engine.init(config.store as never);

    expect(engine.getActiveTheme().id).toBe('midnight-mint');
  });

  it('initializes the active theme from config when the id is valid', () => {
    const config = createConfigStore('solarized-dark');

    engine.init(config.store as never);

    expect(engine.getActiveTheme().id).toBe('solarized-dark');
  });

  it('falls back to tokyo-night and warns when the configured theme is unknown', () => {
    const config = createConfigStore('missing-theme');

    engine.init(config.store as never);

    expect(engine.getActiveTheme().id).toBe('tokyo-night');
    expect(logger.warn).toHaveBeenCalledWith("Theme 'missing-theme' not found; falling back to 'tokyo-night'");
  });

  it('falls back to tokyo-night when setActiveTheme receives an unknown id', () => {
    engine.loadBundledThemes();

    const active = engine.setActiveTheme('not-a-theme');

    expect(active.id).toBe('tokyo-night');
    expect(engine.getActiveTheme().id).toBe('tokyo-night');
  });

  it('returns bundled themes first and then community themes', () => {
    engine.loadBundledThemes();
    fs.writeFileSync(path.join(userThemesDir, 'custom-blue.json'), JSON.stringify(communityTheme), 'utf8');

    engine.loadCommunityThemes();

    const themes = engine.listThemes();
    expect(themes).toHaveLength(16);
    expect(themes.slice(0, 3).map((theme) => theme.id).sort()).toEqual([
      'retro-green',
      'solarized-dark',
      'tokyo-night',
    ]);
    expect(themes.slice(0, -1).some((theme) => theme.id === 'midnight-mint')).toBe(true);
    expect(themes.at(-1)?.id).toBe('custom-blue');
  });

  it('skips duplicate shipped theme ids from later shipped files', () => {
    const bundledDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quakeshell-duplicate-bundled-themes-'));

    try {
      fs.copyFileSync(path.join(path.resolve(process.cwd(), 'themes'), 'tokyo-night.json'), path.join(bundledDir, 'tokyo-night.json'));
      fs.copyFileSync(path.join(path.resolve(process.cwd(), 'themes'), 'retro-green.json'), path.join(bundledDir, 'retro-green.json'));
      fs.copyFileSync(path.join(path.resolve(process.cwd(), 'themes'), 'solarized-dark.json'), path.join(bundledDir, 'solarized-dark.json'));
      fs.writeFileSync(
        path.join(bundledDir, 'theme-boundle-dark.json'),
        JSON.stringify([{ ...communityTheme, id: 'tokyo-night', name: 'Duplicate Tokyo Night' }]),
        'utf8',
      );
      fs.writeFileSync(
        path.join(bundledDir, 'theme-boundle-light.json'),
        JSON.stringify([{ ...communityTheme, id: 'paper-mint', name: 'Paper Mint' }]),
        'utf8',
      );

      const customEngine = new TestThemeEngine(bundledDir, userThemesDir);
      const themes = customEngine.loadBundledThemes();

      expect(themes.find((theme) => theme.id === 'tokyo-night')?.name).toBe('Tokyo Night');
      expect(logger.warn).toHaveBeenCalledWith(
        "Duplicate bundled theme 'tokyo-night' in theme-boundle-dark.json; skipping",
      );

      customEngine.destroy();
    } finally {
      fs.rmSync(bundledDir, { recursive: true, force: true });
    }
  });

  it('broadcasts theme:changed when the config store emits a theme change', () => {
    const config = createConfigStore('tokyo-night');

    engine.init(config.store as never);
    electronMocks.webContentsSend.mockClear();

    config.emitThemeChange('solarized-dark', 'tokyo-night');

    expect(electronMocks.webContentsSend).toHaveBeenCalledWith(
      CHANNELS.THEME_CHANGED,
      expect.objectContaining({ id: 'solarized-dark' }),
    );
  });

  it('loads a valid community theme file', () => {
    engine.loadBundledThemes();
    const communityPath = path.join(userThemesDir, 'custom-blue.json');
    fs.writeFileSync(communityPath, JSON.stringify(communityTheme), 'utf8');

    engine.loadCommunityThemeFile(communityPath);

    expect(engine.listThemes().find((theme) => theme.id === 'custom-blue')).toEqual(communityTheme);
  });

  it('skips a community theme that conflicts with a shipped theme pack theme', () => {
    engine.loadBundledThemes();
    const communityPath = path.join(userThemesDir, 'midnight-mint.json');
    fs.writeFileSync(
      communityPath,
      JSON.stringify({
        ...communityTheme,
        id: 'midnight-mint',
        name: 'Community Midnight Mint',
      }),
      'utf8',
    );

    engine.loadCommunityThemeFile(communityPath);

    expect(engine.listThemes().find((theme) => theme.id === 'midnight-mint')?.name).toBe('Midnight Mint');
    expect(logger.warn).toHaveBeenCalledWith(
      "Community theme 'midnight-mint' conflicts with a bundled theme; skipping",
    );
  });

  it('continues loading other shipped themes when one shipped pack file is malformed', () => {
    const bundledDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quakeshell-bundled-themes-'));

    try {
      for (const file of ['tokyo-night.json', 'retro-green.json', 'solarized-dark.json', 'theme-boundle-light.json']) {
        fs.copyFileSync(path.join(path.resolve(process.cwd(), 'themes'), file), path.join(bundledDir, file));
      }

      fs.writeFileSync(path.join(bundledDir, 'theme-boundle-dark.json'), '{ invalid json', 'utf8');

      const customEngine = new TestThemeEngine(bundledDir, userThemesDir);
      const themes = customEngine.loadBundledThemes();

      expect(themes.some((theme) => theme.id === 'paper-mint')).toBe(true);
      expect(themes.some((theme) => theme.id === 'midnight-mint')).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to load bundled theme file theme-boundle-dark.json:',
        expect.any(SyntaxError),
      );

      customEngine.destroy();
    } finally {
      fs.rmSync(bundledDir, { recursive: true, force: true });
    }
  });

  it('loads all community themes from a single theme bundle file', () => {
    engine.loadBundledThemes();
    const communityPath = path.join(userThemesDir, 'theme-bundle.json');
    fs.writeFileSync(communityPath, JSON.stringify(bundledCommunityThemes), 'utf8');

    engine.loadCommunityThemeFile(communityPath);

    const loadedThemeIds = engine.listThemes().map((theme) => theme.id);
    expect(loadedThemeIds).toContain('custom-blue');
    expect(loadedThemeIds).toContain('custom-mint');
  });

  it('retries transient community JSON parse failures without warning', () => {
    vi.useFakeTimers();

    engine.loadBundledThemes();

    const communityPath = path.join(userThemesDir, 'custom-blue.json');
    fs.writeFileSync(communityPath, '{ "id": "custom-blue"', 'utf8');

    engine.loadCommunityThemeFile(communityPath);
    expect(engine.listThemes().find((theme) => theme.id === 'custom-blue')).toBeUndefined();

    fs.writeFileSync(communityPath, JSON.stringify(communityTheme), 'utf8');
    vi.runOnlyPendingTimers();

    expect(engine.listThemes().find((theme) => theme.id === 'custom-blue')).toEqual(communityTheme);
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse community theme file'),
      expect.anything(),
    );
  });

  it('skips invalid community JSON and warns without crashing after retries are exhausted', () => {
    vi.useFakeTimers();

    const invalidPath = path.join(userThemesDir, 'broken.json');
    fs.writeFileSync(invalidPath, '{ invalid json', 'utf8');

    expect(() => engine.loadCommunityThemeFile(invalidPath)).not.toThrow();

    vi.runAllTimers();

    expect(logger.warn).toHaveBeenCalled();
    expect(engine.listThemes().find((theme) => theme.id === 'broken')).toBeUndefined();
  });

  it('skips community themes missing required fields', () => {
    const invalidPath = path.join(userThemesDir, 'missing-id.json');
    fs.writeFileSync(
      invalidPath,
      JSON.stringify({
        name: 'Missing Id',
        xtermTheme: communityTheme.xtermTheme,
        chromeTokens: communityTheme.chromeTokens,
      }),
      'utf8',
    );

    engine.loadCommunityThemeFile(invalidPath);

    expect(engine.listThemes().find((theme) => theme.name === 'Missing Id')).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid theme structure'));
  });

  it('strips unknown fields from a community theme and still loads it', () => {
    const communityPath = path.join(userThemesDir, 'custom-blue.json');
    fs.writeFileSync(
      communityPath,
      JSON.stringify({
        ...communityTheme,
        extraField: 'ignored',
      }),
      'utf8',
    );

    engine.loadCommunityThemeFile(communityPath);

    const loadedTheme = engine.listThemes().find((theme) => theme.id === 'custom-blue');
    expect(loadedTheme).toBeDefined();
    expect(loadedTheme && 'extraField' in loadedTheme).toBe(false);
  });

  it('removes a deleted community theme and falls back when it was active', () => {
    const communityPath = path.join(userThemesDir, 'custom-blue.json');
    fs.writeFileSync(communityPath, JSON.stringify(communityTheme), 'utf8');

    engine.loadBundledThemes();
    engine.loadCommunityThemeFile(communityPath);
    engine.setActiveTheme('custom-blue');
    electronMocks.webContentsSend.mockClear();

    engine.handleThemeFileDeletion(communityPath, 'custom-blue.json');

    expect(engine.listThemes().find((theme) => theme.id === 'custom-blue')).toBeUndefined();
    expect(engine.getActiveTheme().id).toBe('tokyo-night');
    expect(electronMocks.webContentsSend).toHaveBeenCalledWith(
      CHANNELS.THEME_CHANGED,
      expect.objectContaining({ id: 'tokyo-night' }),
    );
  });

  it('removes every community theme from a deleted theme bundle file', () => {
    const communityPath = path.join(userThemesDir, 'theme-bundle.json');
    fs.writeFileSync(communityPath, JSON.stringify(bundledCommunityThemes), 'utf8');

    engine.loadBundledThemes();
    engine.loadCommunityThemeFile(communityPath);
    engine.setActiveTheme('custom-mint');
    electronMocks.webContentsSend.mockClear();

    engine.handleThemeFileDeletion(communityPath, 'theme-bundle.json');

    expect(engine.listThemes().find((theme) => theme.id === 'custom-blue')).toBeUndefined();
    expect(engine.listThemes().find((theme) => theme.id === 'custom-mint')).toBeUndefined();
    expect(engine.getActiveTheme().id).toBe('tokyo-night');
    expect(electronMocks.webContentsSend).toHaveBeenCalledWith(
      CHANNELS.THEME_CHANGED,
      expect.objectContaining({ id: 'tokyo-night' }),
    );
  });

  it('removes themes from a reloaded theme bundle when they are no longer present', () => {
    const communityPath = path.join(userThemesDir, 'theme-bundle.json');
    fs.writeFileSync(communityPath, JSON.stringify(bundledCommunityThemes), 'utf8');

    engine.loadBundledThemes();
    engine.loadCommunityThemeFile(communityPath);
    engine.setActiveTheme('custom-mint');
    electronMocks.webContentsSend.mockClear();

    fs.writeFileSync(communityPath, JSON.stringify([communityTheme]), 'utf8');
    engine.loadCommunityThemeFile(communityPath);

    expect(engine.listThemes().find((theme) => theme.id === 'custom-blue')).toEqual(communityTheme);
    expect(engine.listThemes().find((theme) => theme.id === 'custom-mint')).toBeUndefined();
    expect(engine.getActiveTheme().id).toBe('tokyo-night');
    expect(electronMocks.webContentsSend).toHaveBeenCalledWith(
      CHANNELS.THEME_CHANGED,
      expect.objectContaining({ id: 'tokyo-night' }),
    );
  });

  it('starts the watcher during init', () => {
    const config = createConfigStore('tokyo-night');

    engine.init(config.store as never);

    expect(engine.watchUserThemesDirSpy).toHaveBeenCalledTimes(1);
  });
});
