# Story P2-4.1: ThemeEngine Module with Bundled Themes

Status: review

## Story

As a user, I want QuakeShell to ship with three built-in named themes I can choose from, so that I have a variety of visual styles without needing external files.

## Acceptance Criteria

- **AC1:** Given the `themes/` directory at the repository root / When inspected / Then it contains `tokyo-night.json`, `retro-green.json`, and `solarized-dark.json`, each matching the `ThemeDefinition` interface shape.
- **AC2:** Given the app starts with `config.theme` set to `'tokyo-night'` / When `ThemeEngine.init()` loads / Then Tokyo Night theme tokens are ready to be applied; no error is thrown if theme files are bundled correctly.
- **AC3:** Given a `theme:list` IPC call / When handled / Then the renderer receives an array of available `ThemeDefinition` objects (at minimum the 3 bundled themes).
- **AC4:** Given `config.theme` changes via hot-reload / When `ThemeEngine` detects the config change / Then `theme:changed` IPC event fires with the new `ThemeDefinition` as payload.
- **AC5:** Given `config.theme` is set to an unknown theme ID that does not exist / When the app loads / Then `ThemeEngine` logs a warning via electron-log and falls back to `'tokyo-night'`.

## Tasks / Subtasks

### Task 1: Define `ThemeDefinition` interface in shared types
- [x] Open (or create) `src/shared/ipc-types.ts`
- [x] Import `ITheme` from `@xterm/xterm` (or `xterm`) as a type-only import
- [x] Export the `ThemeDefinition` interface:
  ```typescript
  export interface ThemeDefinition {
    id: string;       // kebab-case identifier, e.g. 'tokyo-night'
    name: string;     // Human-readable display name, e.g. 'Tokyo Night'
    xtermTheme: ITheme; // xterm.js ITheme — all 16 ANSI colors + bg/fg/cursor
    chromeTokens: {
      bgTerminal: string; // CSS hex — terminal pane background
      bgChrome: string;   // CSS hex — title bar / chrome background
      fgPrimary: string;  // CSS hex — primary text
      fgDimmed: string;   // CSS hex — secondary/muted text
      accent: string;     // CSS hex — highlights, tabs, active borders
      border: string;     // CSS hex — dividers and outlines
    };
  }
  ```
- [x] Verify no circular imports between `src/shared/ipc-types.ts` and existing `src/shared/channels.ts`

### Task 2: Create bundled theme JSON files
- [x] Create `themes/tokyo-night.json` (exact colors below in Dev Notes)
- [x] Create `themes/retro-green.json` (CRT phosphor green on black; see Dev Notes)
- [x] Create `themes/solarized-dark.json` (Solarized Dark canonical palette; see Dev Notes)
- [x] Ensure each file is valid JSON and matches the `ThemeDefinition` shape (all required fields present)

### Task 3: Configure Electron Forge to bundle `themes/` directory
- [x] Open `forge.config.ts`
- [x] In the `packagerConfig.extraResource` array (or add it), include `'./themes'` so the directory is copied to app resources at package time
- [x] Verify the resource path at runtime: `path.join(process.resourcesPath, 'themes')` in packaged build, and `path.join(__dirname, '../../themes')` (or similar) in dev mode
- [x] Add a helper `getThemesDir(): string` to `src/main/theme-engine.ts` that returns the correct path depending on `app.isPackaged`

### Task 4: Implement `ThemeEngine` module
- [x] Create `src/main/theme-engine.ts`
- [x] Implement `loadBundledThemes(): ThemeDefinition[]`:
  - Read all `*.json` files from the bundled `themes/` directory
  - `JSON.parse` each file; validate required shape fields (`id`, `name`, `xtermTheme`, `chromeTokens`)
  - Collect valid themes into an in-memory `Map<string, ThemeDefinition>`
  - Use scoped `electron-log` logger: `log.scope('theme-engine')`
- [x] Implement `init(configStore: ConfigStore)`:
  - Call `loadBundledThemes()`
  - Read `config.theme` from ConfigStore
  - Set `activeTheme` — fall back to `'tokyo-night'` with a `log.warn` if ID not found
  - Subscribe to ConfigStore change events; on `theme` key change, call `setActiveTheme(newId)` and emit `theme:changed`
- [x] Implement `getActiveTheme(): ThemeDefinition`
- [x] Implement `setActiveTheme(id: string): void`:
  - Look up theme by ID from in-memory Map (combined bundled + community)
  - Fall back to `'tokyo-night'` with warning if not found
  - Store reference as `activeTheme`
  - Emit `theme:changed` event via Electron `BrowserWindow.webContents.send()`
- [x] Implement `listThemes(): ThemeDefinition[]` — returns `Array.from(themesMap.values())`
- [x] Export a singleton: `export const themeEngine = new ThemeEngine()`

### Task 5: Register IPC handlers for theming
- [x] Open `src/main/ipc-handlers.ts`
- [x] Add `ipcMain.handle(Channels.THEME_LIST, () => themeEngine.listThemes())`
- [x] Add `ipcMain.handle(Channels.THEME_SET, (_, id: string) => themeEngine.setActiveTheme(id))`
- [x] Verify `Channels.THEME_LIST`, `Channels.THEME_SET`, and `Channels.THEME_CHANGED` exist in `src/shared/channels.ts`; add any missing entries

### Task 6: Wire ThemeEngine into app startup
- [x] Open `src/main/index.ts` (or wherever `app.whenReady()` is handled)
- [x] After ConfigStore is initialized, call `themeEngine.init(configStore)`
- [x] Ensure `themeEngine.init()` is called before the main window is shown so the first render has the correct theme

### Task 7: Write unit tests for ThemeEngine
- [x] Create `src/main/theme-engine.test.ts`
- [x] Test: `loadBundledThemes()` returns exactly 3 themes in dev environment
- [x] Test: `init()` with a valid theme ID sets `activeTheme` to that theme
- [x] Test: `init()` with an unknown theme ID falls back to `'tokyo-night'` and calls `log.warn`
- [x] Test: `setActiveTheme()` with unknown ID falls back to `'tokyo-night'`
- [x] Test: `listThemes()` returns all loaded themes
- [x] Test: ConfigStore change event triggers `theme:changed` IPC emission (mock `BrowserWindow`)
- [x] Mock the file system reads using `vi.mock('fs')` or use fixture theme JSON objects

## Dev Notes

### Architecture Patterns

This story implements **Decision P2-2** from `architecture-v2.md`: the ThemeEngine is a singleton service in the main process. It owns theme state and broadcasts changes to all renderer windows. The renderer never "owns" the active theme — it only reacts to `theme:changed` events and applies them (Story P2-4.2).

**Singleton pattern** in main process:
```typescript
// src/main/theme-engine.ts
import log from 'electron-log/main';
import { app, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { ThemeDefinition } from '../shared/ipc-types';
import { Channels } from '../shared/channels';

const logger = log.scope('theme-engine');
const FALLBACK_THEME_ID = 'tokyo-night';

class ThemeEngine {
  private themes = new Map<string, ThemeDefinition>();
  private activeTheme!: ThemeDefinition;

  private getThemesDir(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'themes');
    }
    // Dev: themes/ is at repo root, two levels above src/main/
    return path.join(__dirname, '../../themes');
  }

  loadBundledThemes(): void {
    const dir = this.getThemesDir();
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
        const parsed = JSON.parse(raw) as ThemeDefinition;
        if (this.isValidTheme(parsed)) {
          this.themes.set(parsed.id, parsed);
        } else {
          logger.warn(`Skipping invalid theme file: ${file}`);
        }
      } catch (err) {
        logger.warn(`Failed to load theme file ${file}:`, err);
      }
    }
  }

  private isValidTheme(obj: unknown): obj is ThemeDefinition {
    if (!obj || typeof obj !== 'object') return false;
    const t = obj as Record<string, unknown>;
    return (
      typeof t.id === 'string' &&
      typeof t.name === 'string' &&
      t.xtermTheme !== null && typeof t.xtermTheme === 'object' &&
      t.chromeTokens !== null && typeof t.chromeTokens === 'object'
    );
  }

  init(/* configStore */): void {
    this.loadBundledThemes();
    // read config.theme, fall back if needed
    // subscribe to config changes
  }

  setActiveTheme(id: string): void {
    const theme = this.themes.get(id);
    if (!theme) {
      logger.warn(`Theme '${id}' not found; falling back to '${FALLBACK_THEME_ID}'`);
      this.activeTheme = this.themes.get(FALLBACK_THEME_ID)!;
    } else {
      this.activeTheme = theme;
    }
    this.broadcast();
  }

  private broadcast(): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(Channels.THEME_CHANGED, this.activeTheme);
    }
  }

  getActiveTheme(): ThemeDefinition { return this.activeTheme; }
  listThemes(): ThemeDefinition[] { return Array.from(this.themes.values()); }
}

export const themeEngine = new ThemeEngine();
```

**IPC channels** — verify `src/shared/channels.ts` has:
```typescript
export const Channels = {
  // ... existing
  THEME_LIST:    'theme:list',
  THEME_SET:     'theme:set',
  THEME_CHANGED: 'theme:changed',
} as const;
```

### Key Files to Create/Modify

| Operation | File | Notes |
|-----------|------|-------|
| CREATE | `themes/tokyo-night.json` | Full JSON below |
| CREATE | `themes/retro-green.json` | CRT phosphor green |
| CREATE | `themes/solarized-dark.json` | Canonical Solarized Dark |
| CREATE | `src/main/theme-engine.ts` | Singleton ThemeEngine class |
| CREATE | `src/main/theme-engine.test.ts` | Vitest unit tests |
| UPDATE | `src/main/ipc-handlers.ts` | Add theme:list, theme:set handlers |
| UPDATE | `src/shared/ipc-types.ts` | Add ThemeDefinition interface |
| UPDATE | `src/shared/channels.ts` | Verify/add THEME_LIST, THEME_SET, THEME_CHANGED |
| UPDATE | `forge.config.ts` | Add `'./themes'` to extraResources |
| UPDATE | `src/main/index.ts` | Call `themeEngine.init(configStore)` on startup |

### Bundled Theme JSON Content

**`themes/tokyo-night.json`**
```json
{
  "id": "tokyo-night",
  "name": "Tokyo Night",
  "xtermTheme": {
    "background": "#1a1b26",
    "foreground": "#c0caf5",
    "cursor": "#7aa2f7",
    "cursorAccent": "#1a1b26",
    "selectionBackground": "#28344a",
    "black": "#414868",
    "red": "#f7768e",
    "green": "#9ece6a",
    "yellow": "#e0af68",
    "blue": "#7aa2f7",
    "magenta": "#bb9af7",
    "cyan": "#7dcfff",
    "white": "#a9b1d6",
    "brightBlack": "#414868",
    "brightRed": "#f7768e",
    "brightGreen": "#9ece6a",
    "brightYellow": "#e0af68",
    "brightBlue": "#7aa2f7",
    "brightMagenta": "#bb9af7",
    "brightCyan": "#7dcfff",
    "brightWhite": "#c0caf5"
  },
  "chromeTokens": {
    "bgTerminal": "#1a1b26",
    "bgChrome": "#13141c",
    "fgPrimary": "#c0caf5",
    "fgDimmed": "#565f89",
    "accent": "#7aa2f7",
    "border": "#2a2b3d"
  }
}
```

**`themes/retro-green.json`** (CRT phosphor green on black)
```json
{
  "id": "retro-green",
  "name": "Retro Green",
  "xtermTheme": {
    "background": "#0a0f0a",
    "foreground": "#33ff33",
    "cursor": "#66ff66",
    "cursorAccent": "#0a0f0a",
    "selectionBackground": "#1a3d1a",
    "black": "#0a0f0a",
    "red": "#cc4444",
    "green": "#33ff33",
    "yellow": "#99cc33",
    "blue": "#22aa55",
    "magenta": "#55cc55",
    "cyan": "#44ffaa",
    "white": "#aaffaa",
    "brightBlack": "#224422",
    "brightRed": "#ff6666",
    "brightGreen": "#66ff66",
    "brightYellow": "#ccff66",
    "brightBlue": "#44cc88",
    "brightMagenta": "#88ff88",
    "brightCyan": "#88ffcc",
    "brightWhite": "#ccffcc"
  },
  "chromeTokens": {
    "bgTerminal": "#0a0f0a",
    "bgChrome": "#050805",
    "fgPrimary": "#33ff33",
    "fgDimmed": "#226622",
    "accent": "#66ff66",
    "border": "#1a3d1a"
  }
}
```

**`themes/solarized-dark.json`** (Canonical Solarized Dark)
```json
{
  "id": "solarized-dark",
  "name": "Solarized Dark",
  "xtermTheme": {
    "background": "#002b36",
    "foreground": "#839496",
    "cursor": "#839496",
    "cursorAccent": "#002b36",
    "selectionBackground": "#073642",
    "black": "#073642",
    "red": "#dc322f",
    "green": "#859900",
    "yellow": "#b58900",
    "blue": "#268bd2",
    "magenta": "#d33682",
    "cyan": "#2aa198",
    "white": "#eee8d5",
    "brightBlack": "#002b36",
    "brightRed": "#cb4b16",
    "brightGreen": "#586e75",
    "brightYellow": "#657b83",
    "brightBlue": "#839496",
    "brightMagenta": "#6c71c4",
    "brightCyan": "#93a1a1",
    "brightWhite": "#fdf6e3"
  },
  "chromeTokens": {
    "bgTerminal": "#002b36",
    "bgChrome": "#00212b",
    "fgPrimary": "#839496",
    "fgDimmed": "#586e75",
    "accent": "#268bd2",
    "border": "#073642"
  }
}
```

### Project Structure Notes

- `themes/` lives at **repo root** (same level as `package.json`), not inside `src/`. This is intentional — it mirrors the pattern for user-installable themes in Story P2-4.3, and Electron Forge can pack it as an extra resource.
- In **dev mode**, `__dirname` inside `src/main/` resolves to `.webpack/main/` (Vite/Forge output). Use `app.getAppPath()` or `path.resolve(__dirname, '../../themes')` and test both paths.
- The `ThemeDefinition` interface lives in `src/shared/ipc-types.ts` so it can be imported by both `src/main/theme-engine.ts` and renderer-side `src/renderer/state/theme-store.ts` (Story P2-4.2) without crossing the main/renderer boundary.
- `ITheme` from xterm.js must be a **type-only** import; do not import runtime xterm.js code into `src/main/`.

### References

- `src/shared/channels.ts` — existing IPC channel constants
- `src/shared/config-schema.ts` — `theme` key (string) added in Epic 1 (P1 prerequisite)
- `src/main/config-store.ts` — emits config change events; subscribe in `ThemeEngine.init()`
- `src/main/ipc-handlers.ts` — existing pattern for `ipcMain.handle()` registration
- `architecture-v2.md` Decision P2-2 — ThemeEngine singleton in main process
- xterm.js `ITheme` interface: `background`, `foreground`, `cursor`, `cursorAccent`, `selectionBackground`, all 16 ANSI color keys

## Dev Agent Record

### Agent Model Used
GitHub Copilot (GPT-5.4)

### Debug Log References
- Focused regression run: `npx vitest run src/main/theme-engine.test.ts src/renderer/state/theme-store.test.ts src/renderer/components/ThemeStyleInjector.test.tsx src/renderer/components/Terminal/TerminalView.test.tsx src/renderer/components/App.test.tsx src/shared/config-schema.test.ts` → 93 tests passed
- Full regression run: `npm test` → 35 test files, 457 tests passed
- Repo-wide lint remains red due pre-existing alias-resolution/style issues unrelated to this epic; targeted lint on changed renderer files passed cleanly

### Completion Notes
- Audited the existing bundled theme implementation already present in the branch and confirmed the packaged theme assets, shared `ThemeDefinition` typing, main-process `ThemeEngine`, theme IPC handlers, preload bridge, and startup wiring satisfy AC1-AC5
- Confirmed the three bundled JSON theme definitions exist under `themes/` and are included in Electron Forge packaging via `extraResource`
- Confirmed fallback behavior to `tokyo-night`, theme list IPC exposure, and change broadcasting through the existing test coverage and full regression suite
- This pass was primarily validation-focused for this story; the remaining code fixes in this session were in renderer import/test drift covered by downstream p2-4 stories

### File List
- `themes/tokyo-night.json` — bundled Tokyo Night theme definition
- `themes/retro-green.json` — bundled Retro Green theme definition
- `themes/solarized-dark.json` — bundled Solarized Dark theme definition
- `forge.config.ts` — packages the bundled `themes/` directory
- `src/shared/ipc-types.ts` — shared `ThemeDefinition` typing
- `src/shared/channels.ts` — theming IPC channel constants
- `src/main/theme-engine.ts` — main-process ThemeEngine singleton and fallback logic
- `src/main/theme-engine.test.ts` — ThemeEngine bundled-theme and fallback coverage
- `src/main/ipc-handlers.ts` — `theme:list`, `theme:set`, and active-theme IPC handlers
- `src/main/index.ts` — ThemeEngine startup and lifecycle wiring
- `src/preload/index.ts` — preload theme API bridge used by renderer clients

## Change Log
- 2026-04-05: Validated the existing bundled ThemeEngine implementation against AC1-AC5, confirmed regression coverage, and marked the story ready for review
