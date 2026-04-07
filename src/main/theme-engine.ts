import { app, BrowserWindow } from 'electron';
import log from 'electron-log/main';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CHANNELS } from '@shared/channels';
import type { ThemeDefinition, ThemeInfo } from '@shared/ipc-types';
import type { ConfigStore } from './config-store';

const logger = log.scope('theme-engine');
const FALLBACK_THEME_ID = 'tokyo-night';
const THEME_RELOAD_DEBOUNCE_MS = 200;
const THEME_PARSE_RETRY_LIMIT = 3;
const BUNDLED_THEME_FILES = [
  'tokyo-night.json',
  'retro-green.json',
  'solarized-dark.json',
] as const;
const SHIPPED_THEME_PACK_FILES = [
  'theme-boundle-dark.json',
  'theme-boundle-light.json',
] as const;

const REQUIRED_XTERM_KEYS = [
  'background',
  'foreground',
  'cursor',
  'cursorAccent',
  'selectionBackground',
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite',
] as const;

const REQUIRED_CHROME_KEYS = [
  'bgTerminal',
  'bgChrome',
  'fgPrimary',
  'fgDimmed',
  'accent',
  'border',
] as const;

export class ThemeEngine {
  private bundledThemes = new Map<string, ThemeDefinition>();
  private communityThemes = new Map<string, ThemeDefinition>();
  private communityThemeSources = new Map<string, string[]>();
  private pendingReloads = new Map<string, NodeJS.Timeout>();
  private activeTheme: ThemeDefinition | null = null;
  private watcher: fs.FSWatcher | null = null;
  private unsubscribeConfigChange: (() => void) | null = null;

  getThemesDir(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'themes');
    }

    return path.join(__dirname, '../../themes');
  }

  getUserThemesDir(): string {
    return path.join(app.getPath('appData'), 'QuakeShell', 'themes');
  }

  loadBundledThemes(): ThemeDefinition[] {
    this.bundledThemes.clear();
    const dir = this.getThemesDir();

    for (const file of BUNDLED_THEME_FILES) {
      this.loadBundledThemeFile(path.join(dir, file), file);
    }

    for (const file of SHIPPED_THEME_PACK_FILES) {
      this.loadBundledThemeFile(path.join(dir, file), file);
    }

    return Array.from(this.bundledThemes.values());
  }

  private loadBundledThemeFile(filePath: string, fileLabel = path.basename(filePath)): void {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      const safeThemes = this.parseThemeFilePayload(parsed, filePath);

      for (const safeTheme of safeThemes) {
        if (this.bundledThemes.has(safeTheme.id)) {
          logger.warn(`Duplicate bundled theme '${safeTheme.id}' in ${fileLabel}; skipping`);
          continue;
        }

        this.bundledThemes.set(safeTheme.id, safeTheme);
      }
    } catch (error) {
      logger.warn(`Failed to load bundled theme file ${fileLabel}:`, error);
    }
  }

  loadCommunityThemes(): void {
    this.communityThemes.clear();
    this.communityThemeSources.clear();

    const dir = this.getUserThemesDir();
    const files = fs.readdirSync(dir).filter((file) => file.endsWith('.json'));

    for (const file of files) {
      this.loadCommunityThemeFile(path.join(dir, file));
    }

    logger.info(`Loaded ${this.communityThemes.size} community themes`);
  }

  loadCommunityThemeFile(filePath: string, parseAttempt = 0): void {
    const resolvedFilePath = path.resolve(filePath);

    try {
      const raw = fs.readFileSync(resolvedFilePath, 'utf-8');
      const parsed = JSON.parse(raw);

      const parsedThemes = this.parseThemeFilePayload(parsed, resolvedFilePath);
      if (parsedThemes.length === 0) {
        return;
      }

      const safeThemes = parsedThemes.filter((safeTheme) => {
        if (this.bundledThemes.has(safeTheme.id)) {
          logger.warn(`Community theme '${safeTheme.id}' conflicts with a bundled theme; skipping`);
          return false;
        }

        return true;
      });

      if (safeThemes.length === 0) {
        return;
      }

      const previousThemeIds = this.communityThemeSources.get(resolvedFilePath) ?? [];
      const nextThemeIds = safeThemes.map((safeTheme) => safeTheme.id);

      for (const previousThemeId of previousThemeIds) {
        if (!nextThemeIds.includes(previousThemeId)) {
          this.communityThemes.delete(previousThemeId);
        }
      }

      for (const safeTheme of safeThemes) {
        this.communityThemes.set(safeTheme.id, safeTheme);
        logger.info(`Loaded community theme: ${safeTheme.id} (${safeTheme.name})`);
      }

      this.communityThemeSources.set(resolvedFilePath, nextThemeIds);

      const activeThemeId = this.activeTheme?.id;
      const activeThemeWasRemoved = Boolean(
        activeThemeId
        && previousThemeIds.includes(activeThemeId)
        && !nextThemeIds.includes(activeThemeId),
      );

      if (activeThemeWasRemoved && activeThemeId) {
        logger.warn(`Active community theme '${activeThemeId}' was removed; falling back to '${FALLBACK_THEME_ID}'`);
        this.setActiveTheme(FALLBACK_THEME_ID);
        return;
      }

      const activeTheme = activeThemeId
        ? safeThemes.find((safeTheme) => safeTheme.id === activeThemeId)
        : undefined;

      if (activeTheme) {
        this.activeTheme = activeTheme;
        this.broadcast();
      }
    } catch (error) {
      if (this.shouldRetryThemeParse(error, resolvedFilePath, parseAttempt)) {
        const nextAttempt = parseAttempt + 1;
        logger.debug(
          `Retrying community theme file parse for ${resolvedFilePath} (${nextAttempt}/${THEME_PARSE_RETRY_LIMIT})`,
        );
        this.scheduleReload(resolvedFilePath, nextAttempt, THEME_RELOAD_DEBOUNCE_MS * nextAttempt);
        return;
      }

      logger.warn(`Failed to parse community theme file ${resolvedFilePath}:`, error);
    }
  }

  init(configStore: ConfigStore): void {
    this.destroy();

    this.loadBundledThemes();
    fs.mkdirSync(this.getUserThemesDir(), { recursive: true });
    this.loadCommunityThemes();

    const configuredThemeId = configStore.get('theme');
    this.setActiveTheme(configuredThemeId);

    this.unsubscribeConfigChange = configStore.onDidChange((key, value) => {
      if (key === 'theme') {
        this.setActiveTheme(String(value));
      }
    });

    this.watchUserThemesDir();
  }

  getActiveTheme(): ThemeDefinition {
    const theme = this.activeTheme ?? this.findThemeById(FALLBACK_THEME_ID);
    if (!theme) {
      throw new Error(`Fallback theme '${FALLBACK_THEME_ID}' was not loaded`);
    }

    return theme;
  }

  setActiveTheme(id: string): ThemeDefinition {
    const requestedTheme = this.findThemeById(id);
    if (!requestedTheme) {
      logger.warn(`Theme '${id}' not found; falling back to '${FALLBACK_THEME_ID}'`);
    }

    const nextTheme = requestedTheme ?? this.findThemeById(FALLBACK_THEME_ID);
    if (!nextTheme) {
      throw new Error(`Fallback theme '${FALLBACK_THEME_ID}' was not loaded`);
    }

    if (this.activeTheme?.id === nextTheme.id) {
      this.activeTheme = nextTheme;
      return nextTheme;
    }

    this.activeTheme = nextTheme;
    this.broadcast();
    return nextTheme;
  }

  listThemes(): ThemeDefinition[] {
    return [
      ...Array.from(this.bundledThemes.values()),
      ...Array.from(this.communityThemes.values()),
    ];
  }

  listThemeInfo(): ThemeInfo[] {
    return [
      ...Array.from(this.bundledThemes.values()).map((theme) => this.toThemeInfo(theme, 'bundled')),
      ...Array.from(this.communityThemes.values()).map((theme) => this.toThemeInfo(theme, 'community')),
    ];
  }

  watchUserThemesDir(): void {
    const dir = this.getUserThemesDir();

    // chokidar is not part of this project; fs.watch is sufficient here and avoids a new dependency.
    this.watcher = fs.watch(dir, { persistent: false }, (eventType, filename) => {
      if (!filename || !filename.endsWith('.json')) {
        return;
      }

      const filePath = path.join(dir, filename);
      this.handleThemeFileEvent(eventType, filePath, filename);
    });

    this.watcher.on('error', (error) => {
      logger.warn('Theme watcher error:', error);
    });
  }

  handleThemeFileEvent(eventType: string, filePath: string, filename: string): void {
    if (eventType === 'rename') {
      if (fs.existsSync(filePath)) {
        this.scheduleReload(filePath);
      } else {
        this.handleThemeFileDeletion(filePath, filename);
      }
      return;
    }

    if (eventType === 'change') {
      this.scheduleReload(filePath);
    }
  }

  handleThemeFileDeletion(filePath: string, filename?: string): void {
    const resolvedFilePath = path.resolve(filePath);
    const themeIds = this.communityThemeSources.get(resolvedFilePath)
      ?? (filename ? [path.parse(filename).name] : []);

    if (themeIds.length === 0) {
      return;
    }

    const activeThemeId = this.activeTheme?.id;
    const wasActiveTheme = Boolean(activeThemeId && themeIds.includes(activeThemeId));
    this.clearPendingReload(resolvedFilePath);
    this.communityThemeSources.delete(resolvedFilePath);

    for (const themeId of themeIds) {
      this.communityThemes.delete(themeId);
    }

    if (wasActiveTheme && activeThemeId) {
      logger.warn(`Active community theme '${activeThemeId}' was removed; falling back to '${FALLBACK_THEME_ID}'`);
      this.setActiveTheme(FALLBACK_THEME_ID);
    }
  }

  destroy(): void {
    this.unsubscribeConfigChange?.();
    this.unsubscribeConfigChange = null;

    this.watcher?.close();
    this.watcher = null;

    for (const timeout of this.pendingReloads.values()) {
      clearTimeout(timeout);
    }
    this.pendingReloads.clear();
  }

  private scheduleReload(filePath: string, parseAttempt = 0, delayMs = THEME_RELOAD_DEBOUNCE_MS): void {
    const resolvedFilePath = path.resolve(filePath);
    const existingTimeout = this.pendingReloads.get(resolvedFilePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this.pendingReloads.delete(resolvedFilePath);
      this.loadCommunityThemeFile(resolvedFilePath, parseAttempt);
    }, delayMs);

    this.pendingReloads.set(resolvedFilePath, timeout);
  }

  private clearPendingReload(filePath: string): void {
    const pendingTimeout = this.pendingReloads.get(filePath);
    if (!pendingTimeout) {
      return;
    }

    clearTimeout(pendingTimeout);
    this.pendingReloads.delete(filePath);
  }

  private broadcast(): void {
    const theme = this.getActiveTheme();
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(CHANNELS.THEME_CHANGED, theme);
    }
  }

  private findThemeById(id: string): ThemeDefinition | undefined {
    return this.bundledThemes.get(id) ?? this.communityThemes.get(id);
  }

  private shouldRetryThemeParse(error: unknown, filePath: string, parseAttempt: number): boolean {
    return error instanceof SyntaxError
      && fs.existsSync(filePath)
      && parseAttempt < THEME_PARSE_RETRY_LIMIT;
  }

  private parseThemeFilePayload(value: unknown, sourceLabel: string): ThemeDefinition[] {
    const isThemeCollection = Array.isArray(value);
    const candidates = isThemeCollection ? value : [value];
    const themes: ThemeDefinition[] = [];

    for (const [index, candidate] of candidates.entries()) {
      if (!this.isValidTheme(candidate)) {
        const entryLabel = isThemeCollection
          ? `${sourceLabel} (index ${index})`
          : sourceLabel;

        logger.warn(`Invalid theme structure in: ${entryLabel}`);
        continue;
      }

      themes.push(this.sanitizeTheme(candidate));
    }

    return themes;
  }

  private isValidTheme(value: unknown): value is ThemeDefinition {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const theme = value as Record<string, unknown>;
    if (typeof theme.id !== 'string' || typeof theme.name !== 'string') {
      return false;
    }

    if (!theme.xtermTheme || typeof theme.xtermTheme !== 'object') {
      return false;
    }

    if (!theme.chromeTokens || typeof theme.chromeTokens !== 'object') {
      return false;
    }

    const xtermTheme = theme.xtermTheme as Record<string, unknown>;
    const chromeTokens = theme.chromeTokens as Record<string, unknown>;

    return REQUIRED_XTERM_KEYS.every((key) => typeof xtermTheme[key] === 'string')
      && REQUIRED_CHROME_KEYS.every((key) => typeof chromeTokens[key] === 'string');
  }

  private sanitizeTheme(theme: ThemeDefinition): ThemeDefinition {
    return {
      id: theme.id,
      name: theme.name,
      xtermTheme: { ...theme.xtermTheme },
      chromeTokens: {
        bgTerminal: theme.chromeTokens.bgTerminal,
        bgChrome: theme.chromeTokens.bgChrome,
        fgPrimary: theme.chromeTokens.fgPrimary,
        fgDimmed: theme.chromeTokens.fgDimmed,
        accent: theme.chromeTokens.accent,
        border: theme.chromeTokens.border,
      },
    };
  }

  private toThemeInfo(theme: ThemeDefinition, source: ThemeInfo['source']): ThemeInfo {
    const sanitizedTheme = this.sanitizeTheme(theme);

    return {
      ...sanitizedTheme,
      source,
      swatchColors: this.extractSwatchColors(sanitizedTheme),
      chromeAccent: sanitizedTheme.chromeTokens.accent,
    };
  }

  private extractSwatchColors(theme: ThemeDefinition): string[] {
    return [
      theme.xtermTheme.background,
      theme.xtermTheme.red,
      theme.xtermTheme.green,
      theme.xtermTheme.yellow,
      theme.xtermTheme.blue,
      theme.xtermTheme.magenta,
      theme.xtermTheme.cyan,
      theme.xtermTheme.foreground,
    ].filter((color): color is string => typeof color === 'string' && color.length > 0);
  }
}

export const themeEngine = new ThemeEngine();