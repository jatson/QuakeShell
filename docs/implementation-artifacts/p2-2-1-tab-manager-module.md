# Story P2-2.1: TabManager Module

Status: review

## Story

As a developer,
I want a `TabManager` main-process module that owns all terminal sessions in a `Map<tabId, TabSession>`,
so that terminal sessions are keyed by UUID, the active tab is tracked, and `TerminalManager` is used as a PTY utility.

## Acceptance Criteria

1. **Given** the app starts **When** `TabManager.init(mainWindow, configStore)` is called **Then** one default `TabSession` is created using the configured `defaultShell`, assigned a `crypto.randomUUID()`, stored in the Map, and `activeTabId` is set to that UUID
2. **Given** a `tab:create` IPC call with optional `{ shellType?, cwd? }` payload **When** handled by `ipc-handlers.ts` **Then** `TabManager.createTab(options)` creates a new `TabSession`, adds it to the Map, sets it as active, and the Promise resolves with the serialized `TabSessionDTO` (no `ptyProcess` field)
3. **Given** a `tab:close` IPC call with `{ tabId: string }` **When** handled **Then** the PTY process for that session is killed via `TerminalManager.killPty(pty)`, the session is removed from the Map, and `tab:closed` is broadcast to the renderer with `{ tabId }`
4. **Given** a `tab:switch` IPC call with `{ tabId: string }` **When** handled **Then** `activeTabId` is updated and `tab:active-changed` is broadcast to the renderer with `{ tabId }`
5. **Given** `src/main/tab-manager.ts` is inspected **When** reviewing imports **Then** `node-pty` is NOT imported directly; all PTY operations go through functions exported from `terminal-manager.ts`
6. **Given** `tabs.maxTabs` tabs already exist **When** `tab:create` IPC is called **Then** it throws an error with message `"Max tabs reached (N)"` and no PTY is spawned
7. **Given** a `tab:list` IPC call **When** handled **Then** it returns an array of all active `TabSessionDTO` objects sorted by creation order
8. **Given** a `tab:rename` IPC call with `{ tabId, name }` **When** handled **Then** the session's `manualName` is updated in the Map and `tab:renamed` is broadcast with `{ tabId, name }`

## Tasks / Subtasks

- [x] Task 1: Refactor `TerminalManager` to expose per-PTY utility functions (AC: #5)
  - [x] 1.1: In `src/main/terminal-manager.ts`, add exported function `spawnPty(shellConfig: string, cols: number, rows: number, onData: (data: string) => void, onExit: (exitCode: number, signal: number) => void): IPty` that creates and returns a new `IPty` instance with proper env/WSL handling (reuse existing `resolveShellPath`, `buildSpawnEnv`, `validateCustomShellPath` helpers)
  - [x] 1.2: Add `writeToPty(pty: IPty, data: string): void` — thin wrapper around `pty.write(data)`
  - [x] 1.3: Add `resizePty(pty: IPty, cols: number, rows: number): void` — thin wrapper around `pty.resize(cols, rows)` with try/catch guard for already-dead processes
  - [x] 1.4: Add `killPty(pty: IPty): void` — calls `pty.kill()` wrapped in `try/catch` (process may already be dead)
  - [x] 1.5: Keep the existing module-level `spawn`, `write`, `resize`, `kill` functions intact (used by v1 single-terminal path until removed in a later story)

- [x] Task 2: Add Phase 2 tab config keys to the schema (AC: #6)
  - [x] 2.1: In `src/shared/config-schema.ts`, extend `configSchema` with two new optional fields using `.default()`:
    ```typescript
    tabs: z.object({
      maxTabs: z.number().min(1).max(20).default(10),
      colorPalette: z.array(z.string()).min(1).default([
        '#7aa2f7','#9ece6a','#bb9af7','#e0af68','#7dcfff','#f7768e',
      ]),
    }).default({}),
    ```
  - [x] 2.2: Verify that existing v1 config files (missing `tabs` key) load without error — Zod `.default({})` should handle this; write a quick manual test or add a test case in `config-schema.test.ts` if one exists

- [x] Task 3: Add tab IPC channel constants (AC: #2, #3, #4, #7, #8)
  - [x] 3.1: In `src/shared/channels.ts`, add to `CHANNELS` object:
    ```typescript
    // Tab management (Phase 2)
    TAB_CREATE:          'tab:create',
    TAB_CLOSE:           'tab:close',
    TAB_SWITCH:          'tab:switch',
    TAB_RENAME:          'tab:rename',
    TAB_LIST:            'tab:list',
    TAB_DATA:            'tab:data',
    TAB_CLOSED:          'tab:closed',
    TAB_ACTIVE_CHANGED:  'tab:active-changed',
    TAB_RENAMED:         'tab:renamed',
    TAB_EXITED:          'tab:exited',
    TAB_INPUT:           'tab:input',
    TAB_RESIZE:          'tab:resize',
    ```

- [x] Task 4: Add tab types to shared IPC types (AC: #2, #7)
  - [x] 4.1: In `src/shared/ipc-types.ts`, add:
    ```typescript
    export type TabColor = string; // hex color from palette, e.g. '#7aa2f7'

    export type Shell = 'powershell' | 'pwsh' | 'cmd' | 'bash' | 'wsl' | string;

    /** Serializable tab session — safe to send over IPC (no IPty reference) */
    export interface TabSessionDTO {
      id: string;
      shellType: Shell;
      color: TabColor;
      manualName?: string;
      createdAt: number;   // Date.now() timestamp for ordering
    }

    export interface TabCreateOptions {
      shellType?: Shell;
      cwd?: string;
    }

    export interface TabDataPayload {
      tabId: string;
      data: string;
    }

    export interface TabClosedPayload {
      tabId: string;
    }

    export interface TabActiveChangedPayload {
      tabId: string;
    }

    export interface TabExitedPayload {
      tabId: string;
      exitCode: number;
      signal: number;
    }

    export interface TabRenamedPayload {
      tabId: string;
      name: string;
    }
    ```
  - [x] 4.2: Add `QuakeShellTabAPI` interface to `ipc-types.ts`:
    ```typescript
    export interface QuakeShellTabAPI {
      create(options?: TabCreateOptions): Promise<TabSessionDTO>;
      close(tabId: string): Promise<void>;
      switchTo(tabId: string): Promise<void>;
      rename(tabId: string, name: string): Promise<void>;
      list(): Promise<TabSessionDTO[]>;
      input(tabId: string, data: string): Promise<void>;
      resize(tabId: string, cols: number, rows: number): Promise<void>;
      onData(callback: (payload: TabDataPayload) => void): () => void;
      onClosed(callback: (payload: TabClosedPayload) => void): () => void;
      onActiveChanged(callback: (payload: TabActiveChangedPayload) => void): () => void;
      onExited(callback: (payload: TabExitedPayload) => void): () => void;
      onRenamed(callback: (payload: TabRenamedPayload) => void): () => void;
    }
    ```
  - [x] 4.3: Add `tab: QuakeShellTabAPI` to the `QuakeShellAPI` interface

- [x] Task 5: Create `src/main/tab-manager.ts` (AC: #1–#8)
  - [x] 5.1: Define the internal `TabSession` interface (includes `ptyProcess: IPty`):
    ```typescript
    import type { IPty } from 'node-pty';
    import type { TabSessionDTO, TabColor, Shell, TabCreateOptions } from '@shared/ipc-types';

    interface TabSession {
      id: string;
      shellType: Shell;
      ptyProcess: IPty;
      color: TabColor;
      manualName?: string;
      createdAt: number;
    }
    ```
  - [x] 5.2: Module-level state:
    ```typescript
    const tabs = new Map<string, TabSession>();
    let activeTabId: string | null = null;
    let mainWindow: BrowserWindow | null = null;
    let colorPaletteIndex = 0;
    ```
  - [x] 5.3: Implement `toDTO(session: TabSession): TabSessionDTO` — strips `ptyProcess` before sending over IPC
  - [x] 5.4: Implement `getNextColor(): TabColor` — reads `configStore.get('tabs').colorPalette`, returns `palette[colorPaletteIndex % palette.length]` then increments `colorPaletteIndex`
  - [x] 5.5: Implement `init(window: BrowserWindow, store: ConfigStore): Promise<void>`:
    - Store `mainWindow` reference
    - Call `createTab({})` to create the first session
    - Log: `logger.info('TabManager initialized with default tab', { tabId })`
  - [x] 5.6: Implement `createTab(options: TabCreateOptions): TabSessionDTO`:
    - Check `tabs.size >= configStore.get('tabs').maxTabs` → throw `new Error(\`Max tabs reached (\${maxTabs})\`)`
    - Generate `id = crypto.randomUUID()`
    - Determine `shellType` from `options.shellType ?? configStore.get('defaultShell')`
    - Assign `color = getNextColor()`
    - Call `terminalManager.spawnPty(shellType, 80, 24, onData, onExit)` where:
      - `onData`: broadcasts `CHANNELS.TAB_DATA` with `{ tabId: id, data }` to mainWindow
      - `onExit`: broadcasts `CHANNELS.TAB_EXITED` with `{ tabId: id, exitCode, signal }` to mainWindow
    - Store session in `tabs` Map
    - Call `setActiveTab(id)` (does NOT broadcast yet — caller decides)
    - Return `toDTO(session)`
  - [x] 5.7: Implement `closeTab(tabId: string): void`:
    - Guard: if `!tabs.has(tabId)` throw `new Error(\`Tab not found: \${tabId}\`)`
    - Call `terminalManager.killPty(session.ptyProcess)`
    - Delete from `tabs` Map
    - Broadcast `CHANNELS.TAB_CLOSED` with `{ tabId }` to mainWindow
    - If `activeTabId === tabId`: pick adjacent tab (first remaining in Map iteration order) and call `setActiveTab(nextId)` — if Map is now empty, set `activeTabId = null`
  - [x] 5.8: Implement `setActiveTab(tabId: string): void`:
    - Update `activeTabId = tabId`
    - Broadcast `CHANNELS.TAB_ACTIVE_CHANGED` with `{ tabId }` to mainWindow
  - [x] 5.9: Implement `renameTab(tabId: string, name: string): void`:
    - Guard: if `!tabs.has(tabId)` throw
    - Set `session.manualName = name`
    - Broadcast `CHANNELS.TAB_RENAMED` with `{ tabId, name }` to mainWindow
  - [x] 5.10: Implement `listTabs(): TabSessionDTO[]` — returns `[...tabs.values()].map(toDTO)` in insertion order
  - [x] 5.11: Implement `writeToTab(tabId: string, data: string): void` — calls `terminalManager.writeToPty(session.ptyProcess, data)`
  - [x] 5.12: Implement `resizeTab(tabId: string, cols: number, rows: number): void` — calls `terminalManager.resizePty(session.ptyProcess, cols, rows)`
  - [x] 5.13: Add `export { init, createTab, closeTab, setActiveTab, renameTab, listTabs, writeToTab, resizeTab, getActiveTabId }` at module bottom

- [x] Task 6: Register tab IPC handlers in `src/main/ipc-handlers.ts` (AC: #2–#4, #6–#8)
  - [x] 6.1: Import `* as tabManager from './tab-manager'` at top of `ipc-handlers.ts`
  - [x] 6.2: Add `ipcMain.handle(CHANNELS.TAB_CREATE, async (_event, options) => tabManager.createTab(options ?? {}))` — wrap in `try/catch`, re-throw as `new Error(message)`
  - [x] 6.3: Add `ipcMain.handle(CHANNELS.TAB_CLOSE, async (_event, { tabId }) => tabManager.closeTab(tabId))`
  - [x] 6.4: Add `ipcMain.handle(CHANNELS.TAB_SWITCH, async (_event, { tabId }) => tabManager.setActiveTab(tabId))`
  - [x] 6.5: Add `ipcMain.handle(CHANNELS.TAB_RENAME, async (_event, { tabId, name }) => tabManager.renameTab(tabId, name))`
  - [x] 6.6: Add `ipcMain.handle(CHANNELS.TAB_LIST, async () => tabManager.listTabs())`
  - [x] 6.7: Add `ipcMain.handle(CHANNELS.TAB_INPUT, async (_event, { tabId, data }) => tabManager.writeToTab(tabId, data))`
  - [x] 6.8: Add `ipcMain.handle(CHANNELS.TAB_RESIZE, async (_event, { tabId, cols, rows }) => tabManager.resizeTab(tabId, cols, rows))`

- [x] Task 7: Expose Tab API in preload `src/preload/index.ts` (AC: #2–#4)
  - [x] 7.1: Add `tab` namespace to the `contextBridge.exposeInMainWorld('quakeshell', { ... })` call:
    ```typescript
    tab: {
      create: (options?: TabCreateOptions) =>
        ipcRenderer.invoke(CHANNELS.TAB_CREATE, options),
      close: (tabId: string) =>
        ipcRenderer.invoke(CHANNELS.TAB_CLOSE, { tabId }),
      switchTo: (tabId: string) =>
        ipcRenderer.invoke(CHANNELS.TAB_SWITCH, { tabId }),
      rename: (tabId: string, name: string) =>
        ipcRenderer.invoke(CHANNELS.TAB_RENAME, { tabId, name }),
      list: () =>
        ipcRenderer.invoke(CHANNELS.TAB_LIST),
      input: (tabId: string, data: string) =>
        ipcRenderer.invoke(CHANNELS.TAB_INPUT, { tabId, data }),
      resize: (tabId: string, cols: number, rows: number) =>
        ipcRenderer.invoke(CHANNELS.TAB_RESIZE, { tabId, cols, rows }),
      onData: (callback: (payload: { tabId: string; data: string }) => void) => {
        const listener = (_e: IpcRendererEvent, payload: TabDataPayload) => callback(payload);
        ipcRenderer.on(CHANNELS.TAB_DATA, listener);
        return () => ipcRenderer.removeListener(CHANNELS.TAB_DATA, listener);
      },
      onClosed: (callback: (payload: TabClosedPayload) => void) => {
        const listener = (_e: IpcRendererEvent, payload: TabClosedPayload) => callback(payload);
        ipcRenderer.on(CHANNELS.TAB_CLOSED, listener);
        return () => ipcRenderer.removeListener(CHANNELS.TAB_CLOSED, listener);
      },
      onActiveChanged: (callback: (payload: TabActiveChangedPayload) => void) => {
        const listener = (_e: IpcRendererEvent, payload: TabActiveChangedPayload) => callback(payload);
        ipcRenderer.on(CHANNELS.TAB_ACTIVE_CHANGED, listener);
        return () => ipcRenderer.removeListener(CHANNELS.TAB_ACTIVE_CHANGED, listener);
      },
      onExited: (callback: (payload: TabExitedPayload) => void) => {
        const listener = (_e: IpcRendererEvent, payload: TabExitedPayload) => callback(payload);
        ipcRenderer.on(CHANNELS.TAB_EXITED, listener);
        return () => ipcRenderer.removeListener(CHANNELS.TAB_EXITED, listener);
      },
      onRenamed: (callback: (payload: TabRenamedPayload) => void) => {
        const listener = (_e: IpcRendererEvent, payload: TabRenamedPayload) => callback(payload);
        ipcRenderer.on(CHANNELS.TAB_RENAMED, listener);
        return () => ipcRenderer.removeListener(CHANNELS.TAB_RENAMED, listener);
      },
    },
    ```
  - [x] 7.2: Import required types from `@shared/ipc-types` at the top of `preload/index.ts`

- [x] Task 8: Initialize TabManager in `src/main/index.ts` (AC: #1)
  - [x] 8.1: Import `* as tabManager from './tab-manager'` in `app-lifecycle.ts`
  - [x] 8.2: After `mainWindow` is created and ready, call `await tabManager.init(mainWindow, configStore)` — this replaces the existing `terminalManager.spawn(...)` call for the initial session

- [x] Task 9: Write unit tests in `src/main/tab-manager.test.ts` (AC: #1–#8)
  - [x] 9.1: Mock `terminal-manager` module: `vi.mock('./terminal-manager', () => ({ spawnPty: vi.fn().mockReturnValue({ write: vi.fn(), resize: vi.fn(), kill: vi.fn() }), writeToPty: vi.fn(), resizePty: vi.fn(), killPty: vi.fn() }))`
  - [x] 9.2: Mock `electron`: `vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: vi.fn(() => [{ webContents: { send: vi.fn() } }]) } }))` — or provide a mock mainWindow in `init()`
  - [x] 9.3: Mock `config-store` with test defaults: `{ defaultShell: 'powershell', tabs: { maxTabs: 10, colorPalette: ['#7aa2f7','#9ece6a'] } }`
  - [x] 9.4: Test `init()` creates exactly one tab, sets it as active, calls `terminalManager.spawnPty` once
  - [x] 9.5: Test `createTab()` increments tab count, returns correct `TabSessionDTO` shape, assigns color cycling
  - [x] 9.6: Test `createTab()` throws when `tabs.size >= maxTabs`
  - [x] 9.7: Test `closeTab()` calls `killPty`, emits `tab:closed`, removes from Map
  - [x] 9.8: Test `closeTab()` on active tab updates `activeTabId` to an adjacent tab
  - [x] 9.9: Test `setActiveTab()` calls `webContents.send` with `tab:active-changed`
  - [x] 9.10: Test `renameTab()` sets `manualName` and broadcasts `tab:renamed`
  - [x] 9.11: Test `listTabs()` returns DTOs without `ptyProcess` field

## Dev Notes

### Architecture Patterns

**TerminalManager as PTY utility:** The existing `terminal-manager.ts` module currently has module-level singleton PTY state. For multi-tab, `TabManager` owns the `Map<tabId, TabSession>` where each `TabSession.ptyProcess` is an `IPty` instance. `TerminalManager` is refactored to expose stateless per-PTY utility functions (`spawnPty`, `writeToPty`, `resizePty`, `killPty`) while keeping the old module-level functions intact for backward compatibility until the v1 IPC handlers are retired.

**IPC broadcast pattern:** `TabManager` holds a reference to `mainWindow: BrowserWindow` (passed in `init()`). Main→renderer events use `mainWindow.webContents.send(channel, payload)`. This is consistent with the existing `broadcastConfigChange` pattern in `ipc-handlers.ts`.

**Tab data routing:** When a PTY produces output, the `onData` callback in `spawnPty` immediately calls `mainWindow.webContents.send(CHANNELS.TAB_DATA, { tabId, data })`. The renderer's `tab-store.ts` subscribes to this and routes data to the correct xterm.js instance by `tabId`.

**Color assignment:** Colors cycle through `config.tabs.colorPalette` using a module-level `colorPaletteIndex`. Closing a tab does NOT reclaim its color slot — the index only ever increments (wrapping via modulo). This is intentional to avoid visual confusion from color reassignment.

**`crypto.randomUUID()`** is available in Node 14.17+ as `require('crypto').randomUUID()`. Since Node 24 is the target, use `import { randomUUID } from 'node:crypto'`.

### Key Files to Create/Modify

| File | Action | Notes |
|---|---|---|
| `src/main/tab-manager.ts` | CREATE | Core module; ~150–200 lines |
| `src/main/tab-manager.test.ts` | CREATE | Unit tests; mock pty + electron |
| `src/main/terminal-manager.ts` | MODIFY | Add `spawnPty`, `writeToPty`, `resizePty`, `killPty` exports |
| `src/main/ipc-handlers.ts` | MODIFY | Add tab:* `ipcMain.handle` registrations |
| `src/main/app-lifecycle.ts` | MODIFY | Call `tabManager.init()` after window ready |
| `src/shared/channels.ts` | MODIFY | Add TAB_* channel constants |
| `src/shared/ipc-types.ts` | MODIFY | Add `TabSessionDTO`, `QuakeShellTabAPI`, payload types |
| `src/shared/config-schema.ts` | MODIFY | Add `tabs: { maxTabs, colorPalette }` with Zod defaults |
| `src/preload/index.ts` | MODIFY | Expose `window.quakeshell.tab` namespace |

### Project Structure Notes

- `src/main/app-lifecycle.ts` currently calls `terminalManager.spawn(shell, cols, rows)` during app ready — replace with `tabManager.init(mainWindow, configStore)` which internally calls `createTab({})`.
- The v1 `terminal:spawn`, `terminal:write`, `terminal:resize`, `terminal:data`, `terminal:process-exit` IPC channels must remain registered in this story (single-terminal v1 TerminalView still uses them). They will be removed in a later refactor story once `TerminalView` is updated to use `tab:input` / `tab:data`.
- `electron-log` scoping: use `const log = electronLog.scope('tab-manager')` at the module level.
- Import path alias: `@shared/` maps to `src/shared/` per existing tsconfig paths.

### References

- `src/main/terminal-manager.ts` — study `spawn()` implementation for env/WSL handling to replicate in `spawnPty()`
- `src/main/ipc-handlers.ts` — follow existing try/catch + re-throw pattern for all new handlers
- `src/shared/channels.ts` — existing channel constant naming convention: `DOMAIN_ACTION`
- `docs/planning-artifacts/architecture-v2.md` — Decision P2-1 for TabSession shape
- `docs/planning-artifacts/epics-v2.md` — ARCH-P2-01 through ARCH-P2-03

## File List

| File | Action |
|---|---|
| `src/main/tab-manager.ts` | CREATED |
| `src/main/tab-manager.test.ts` | CREATED |
| `src/main/terminal-manager.ts` | MODIFIED — added `spawnPty`, `writeToPty`, `resizePty`, `killPty` exports |
| `src/main/ipc-handlers.ts` | MODIFIED — added tab IPC handlers (create, close, switch, rename, list, input, resize) |
| `src/main/index.ts` | MODIFIED — added `tabManager.init()` call after window creation |
| `src/shared/channels.ts` | MODIFIED — added TAB_* channel constants |
| `src/shared/ipc-types.ts` | MODIFIED — added tab types, DTOs, `QuakeShellTabAPI` |
| `src/shared/config-schema.ts` | MODIFIED — added `tabs` object with `maxTabs` and `colorPalette` |
| `src/preload/index.ts` | MODIFIED — exposed full `tab` namespace in contextBridge |

## Change Log

- 2026-04-04: Implemented TabManager module with full multi-tab session management (Tasks 1–9). All 8 acceptance criteria satisfied. 17 new unit tests in `tab-manager.test.ts`. 377 total tests pass, 0 regressions.

## Dev Agent Record

### Implementation Plan

- Refactored `TerminalManager` to expose stateless per-PTY utility functions (`spawnPty`, `writeToPty`, `resizePty`, `killPty`) while keeping legacy module-level singleton functions intact for backward compatibility.
- Created `TabManager` as the session owner with `Map<tabId, TabSession>` keyed by `crypto.randomUUID()`.
- Color assignment cycles through `config.tabs.colorPalette` with a monotonically incrementing index (modulo wrap).
- IPC handlers follow existing try/catch + re-throw pattern. All tab operations are registered as `ipcMain.handle` for invoke/result semantics.
- Main→renderer broadcasts use `mainWindow.webContents.send()` consistent with existing patterns.
- TabManager initialization moved to `src/main/index.ts` step 5, replacing direct `terminalManager.spawn()` for the initial session.

### Completion Notes

All 9 tasks complete. All 8 acceptance criteria verified:
- AC1: `init()` creates default tab with UUID, stores in Map, sets activeTabId ✓
- AC2: `tab:create` handler creates new TabSession, returns serialized DTO without `ptyProcess` ✓
- AC3: `tab:close` kills PTY via `terminalManager.killPty()`, removes from Map, broadcasts `tab:closed` ✓
- AC4: `tab:switch` updates `activeTabId`, broadcasts `tab:active-changed` ✓
- AC5: `tab-manager.ts` does NOT import `node-pty` directly; all PTY ops go through `terminal-manager.ts` ✓
- AC6: `createTab()` throws `"Max tabs reached (N)"` when size >= maxTabs ✓
- AC7: `tab:list` returns sorted `TabSessionDTO[]` ✓
- AC8: `tab:rename` updates `manualName`, broadcasts `tab:renamed` ✓

Test results: 377 passed, 0 failed (27 test files). 17 new tests in `tab-manager.test.ts`.
