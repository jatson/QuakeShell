# Story P2-1.2: Refactor terminal:data IPC to tab:data

Status: review

## Story

As a developer,
I want the `terminal:data` IPC channel renamed to `tab:data` with a `tabId` field in the payload,
so that all terminal data events are scoped to a specific session, enabling the multi-tab architecture.

## Acceptance Criteria

1. **Given** a running terminal session **When** the PTY emits output **Then** the renderer receives a `tab:data` event with `{ tabId: string, data: string }` payload (not a bare `{ data: string }` payload)

2. **Given** the renderer sends user input **When** the user types in the terminal **Then** the input is forwarded via `tab:input` with `{ tabId: string, data: string }` and the correct PTY process receives it

3. **Given** `src/shared/channels.ts` after this story **When** it is inspected **Then** `TERMINAL_DATA` and `TERMINAL_WRITE` channel constants no longer exist (or are removed/commented); `TAB_DATA`, `TAB_INPUT`, `TAB_CREATE`, `TAB_CLOSE`, `TAB_SWITCH`, `TAB_RENAME`, `TAB_LIST`, `TAB_CREATE_SPLIT`, `TAB_EXITED`, and `TAB_AUTO_NAME` all exist as constants

4. **Given** `src/preload/index.ts` after this story **When** it is inspected **Then** the contextBridge API exposes a `tab` namespace with `input()` and `onData()` methods; the old `terminal.write()` and `terminal.onData()` methods are removed from the `terminal` namespace

5. **Given** only one tab exists (the current single-session v1 behaviour) **When** the user types and the PTY responds **Then** the I/O cycle is functionally identical to v1 — the `tabId: 'default'` value is transparent to the user

6. **Given** `src/renderer/components/Terminal/TerminalView.tsx` after this story **When** it subscribes to terminal data **Then** it calls `window.quakeshell.tab.onData(callback)` and the callback only processes events where `payload.tabId === props.tabId`; it sends input via `window.quakeshell.tab.input({ tabId: props.tabId, data })`

7. **Given** `src/main/ipc-handlers.test.ts` after this story **When** tests run **Then** all tests pass and no test references `TERMINAL_DATA` or `TERMINAL_WRITE`

8. **Given** `src/main/terminal-manager.ts` after this story **When** the data callback is registered **Then** the emitted event carries the channel name `tab:data` (i.e., `CHANNELS.TAB_DATA`) and includes `tabId: 'default'` in the payload

## Tasks / Subtasks

- [x] Task 1: Update `src/shared/channels.ts` — replace terminal I/O channels, add all tab channels (AC: #3)
  - [x] 1.1: Remove (or replace by commenting out with a `// DEPRECATED:` marker) `TERMINAL_DATA` and `TERMINAL_WRITE` entries
  - [x] 1.2: Add the following tab channel constants:
    ```typescript
    // Tab I/O (replaces TERMINAL_DATA / TERMINAL_WRITE)
    TAB_DATA: 'tab:data',          // main → renderer (send)
    TAB_INPUT: 'tab:input',        // renderer → main (invoke)
    // Tab lifecycle (renderer → main, invoke)
    TAB_CREATE: 'tab:create',
    TAB_CLOSE: 'tab:close',
    TAB_SWITCH: 'tab:switch',
    TAB_RENAME: 'tab:rename',
    TAB_LIST: 'tab:list',
    TAB_CREATE_SPLIT: 'tab:create-split',
    // Tab events (main → renderer, send)
    TAB_EXITED: 'tab:exited',
    TAB_AUTO_NAME: 'tab:auto-name',
    ```
  - [x] 1.3: Keep all other channels untouched: `TERMINAL_SPAWN`, `TERMINAL_RESIZE`, `TERMINAL_PROCESS_EXIT`, `TERMINAL_RESPAWN`, all `CONFIG_*`, `WINDOW_*`, `APP_*`

- [x] Task 2: Add new IPC payload types to `src/shared/ipc-types.ts` (AC: #1, #2)
  - [x] 2.1: Add `TabDataPayload` interface:
    ```typescript
    export interface TabDataPayload {
      tabId: string;
      data: string;
    }
    ```
  - [x] 2.2: Add `TabInputPayload` interface:
    ```typescript
    export interface TabInputPayload {
      tabId: string;
      data: string;
    }
    ```
  - [x] 2.3: Add `TabExitedPayload` interface (for future use by Epic 2, but channel stub is registered here):
    ```typescript
    export interface TabExitedPayload {
      tabId: string;
      exitCode: number;
      signal: number;
    }
    ```
  - [x] 2.4: Add `TabAutoNamePayload` interface:
    ```typescript
    export interface TabAutoNamePayload {
      tabId: string;
      name: string;
    }
    ```
  - [x] 2.5: Update `QuakeShellTerminalAPI` in `ipc-types.ts`: remove `write` and `onData` from the interface (they move to `QuakeShellTabAPI`)
  - [x] 2.6: Add `QuakeShellTabAPI` interface:
    ```typescript
    export interface QuakeShellTabAPI {
      input(payload: TabInputPayload): Promise<void>;
      onData(callback: (payload: TabDataPayload) => void): () => void;
      onExited(callback: (payload: TabExitedPayload) => void): () => void;
      onAutoName(callback: (payload: TabAutoNamePayload) => void): () => void;
    }
    ```
  - [x] 2.7: Add `tab: QuakeShellTabAPI` to the `QuakeShellAPI` interface (alongside the existing `terminal`, `config`, `window`, `app` fields)

- [x] Task 3: Update `src/preload/index.ts` — expose `tab` namespace, remove `write`/`onData` from `terminal` (AC: #4, #5)
  - [x] 3.1: Remove `write` from the `terminal` namespace:
    - Delete the `write: (data: string) => ipcRenderer.invoke(CHANNELS.TERMINAL_WRITE, { data })` line
  - [x] 3.2: Remove `onData` from the `terminal` namespace:
    - Delete the `onData` listener registration that listens on `CHANNELS.TERMINAL_DATA`
  - [x] 3.3: Add a new top-level `tab` namespace in the `contextBridge.exposeInMainWorld` call:
    ```typescript
    tab: {
      input: (payload: { tabId: string; data: string }) =>
        ipcRenderer.invoke(CHANNELS.TAB_INPUT, payload),
      onData: (callback: (payload: { tabId: string; data: string }) => void) => {
        const listener = (
          _event: Electron.IpcRendererEvent,
          payload: { tabId: string; data: string },
        ) => callback(payload);
        ipcRenderer.on(CHANNELS.TAB_DATA, listener);
        return () => ipcRenderer.removeListener(CHANNELS.TAB_DATA, listener);
      },
      onExited: (callback: (payload: { tabId: string; exitCode: number; signal: number }) => void) => {
        const listener = (
          _event: Electron.IpcRendererEvent,
          payload: { tabId: string; exitCode: number; signal: number },
        ) => callback(payload);
        ipcRenderer.on(CHANNELS.TAB_EXITED, listener);
        return () => ipcRenderer.removeListener(CHANNELS.TAB_EXITED, listener);
      },
      onAutoName: (callback: (payload: { tabId: string; name: string }) => void) => {
        const listener = (
          _event: Electron.IpcRendererEvent,
          payload: { tabId: string; name: string },
        ) => callback(payload);
        ipcRenderer.on(CHANNELS.TAB_AUTO_NAME, listener);
        return () => ipcRenderer.removeListener(CHANNELS.TAB_AUTO_NAME, listener);
      },
    },
    ```
  - [x] 3.4: Keep all other `terminal` namespace methods intact: `spawn`, `resize`, `onProcessExit`, `respawnShell`
  - [x] 3.5: Verify the file compiles: `npx tsc --noEmit`

- [x] Task 4: Update `src/main/terminal-manager.ts` — emit `tab:data` with hardcoded `tabId: 'default'` (AC: #8)
  - [x] 4.1: The `dataCallback` in terminal-manager is set by `ipc-handlers.ts` via `terminalManager.onData(cb)`. The callback signature is currently `(data: string) => void`. This needs to change to `(tabId: string, data: string) => void` so the IPC handler can include tabId in the broadcast.
  - [x] 4.2: Update the `dataCallback` type from `((data: string) => void) | null` to `((tabId: string, data: string) => void) | null`
  - [x] 4.3: Update the `onData` export and all call sites within terminal-manager that call `dataCallback(data)` to instead call `dataCallback('default', data)` (hardcoded tabId for the single-session bridge phase)
  - [x] 4.4: Update the `export function onData()` function signature:
    ```typescript
    // Before:
    export function onData(callback: (data: string) => void): void
    // After:
    export function onData(callback: (tabId: string, data: string) => void): void
    ```
  - [x] 4.5: No other changes to terminal-manager.ts — `spawn`, `write`, `resize`, `kill`, `onExit`, `onBell`, `getDefaultShell`, etc. all stay unchanged

- [x] Task 5: Update `src/main/ipc-handlers.ts` — replace `TERMINAL_WRITE` handler with `TAB_INPUT`, update data broadcast (AC: #2, #7)
  - [x] 5.1: Remove the `ipcMain.handle(CHANNELS.TERMINAL_WRITE, ...)` handler
  - [x] 5.2: Add the `tab:input` handler:
    ```typescript
    ipcMain.handle(
      CHANNELS.TAB_INPUT,
      async (_event, { tabId, data }: { tabId: string; data: string }) => {
        try {
          // In this bridge phase, only 'default' tabId exists — route all to single PTY
          logger.debug(`tab:input tabId=${tabId}`);
          terminalManager.write(data);
        } catch (error) {
          logger.error('tab:input failed:', error);
          throw new Error(
            error instanceof Error ? error.message : 'Failed to write to terminal',
          );
        }
      },
    );
    ```
  - [x] 5.3: Update the `terminalManager.onData(...)` callback registration (currently line ~`terminalManager.onData((data) => { mainWindow.webContents.send(CHANNELS.TERMINAL_DATA, { data }); })`) to use the new signature and new channel:
    ```typescript
    terminalManager.onData((tabId: string, data: string) => {
      mainWindow.webContents.send(CHANNELS.TAB_DATA, { tabId, data });
    });
    ```
  - [x] 5.4: Keep all other `ipcMain.handle` registrations untouched: `TERMINAL_SPAWN`, `TERMINAL_RESIZE`, `TERMINAL_RESPAWN`, all config handlers, window handlers, app handlers

- [x] Task 6: Update `src/renderer/components/Terminal/TerminalView.tsx` — accept `tabId` prop, filter events (AC: #6)
  - [x] 6.1: Add `tabId: string` to `TerminalViewProps` interface:
    ```typescript
    export interface TerminalViewProps {
      tabId: string;        // NEW — required; used to filter tab:data events
      opacity?: number;
      fontSize?: number;
      fontFamily?: string;
    }
    ```
  - [x] 6.2: Destructure `tabId` from props in the component function signature
  - [x] 6.3: Replace the `window.quakeshell.terminal.write(data)` call in `terminal.onData()` (xterm user input handler) with:
    ```typescript
    window.quakeshell.tab.input({ tabId, data });
    ```
  - [x] 6.4: Replace the `window.quakeshell.terminal.onData(...)` subscription with:
    ```typescript
    const removeDataListener = window.quakeshell.tab.onData(
      (payload: { tabId: string; data: string }) => {
        if (payload.tabId !== tabId) return;  // filter to this tab's events only
        terminal.write(payload.data);
      },
    );
    ```
  - [x] 6.5: Replace the right-click context menu paste handler's `window.quakeshell.terminal.write(text)` call with `window.quakeshell.tab.input({ tabId, data: text })`
  - [x] 6.6: Replace the `textarea.attachCustomKeyEventHandler` Ctrl+V paste handler's `write(text)` call with `window.quakeshell.tab.input({ tabId, data: text })`
  - [x] 6.7: Replace the respawn input handler (`data === '\r'` branch) `terminal.write` with the tab.input call:
    ```typescript
    window.quakeshell.tab.input({ tabId, data });
    ```
    Note: `respawnShell()` is unchanged — it still calls `window.quakeshell.terminal.respawnShell()`
  - [x] 6.8: Update `return () => { removeDataListener(); ... }` cleanup in the `useEffect` to ensure the new listener is removed on unmount

- [x] Task 7: Update `src/renderer/components/App.tsx` — pass `tabId` prop to `TerminalView` (AC: #6)
  - [x] 7.1: Read `src/renderer/components/App.tsx` to see the current `TerminalView` usage
  - [x] 7.2: Pass `tabId="default"` to `<TerminalView />` (hardcoded for the single-session bridge phase):
    ```tsx
    <TerminalView tabId="default" />
    ```

- [x] Task 8: Update `src/main/ipc-handlers.test.ts` and `src/main/terminal-manager.test.ts` (AC: #7)
  - [x] 8.1: In `ipc-handlers.test.ts`: find any test that registers or invokes `CHANNELS.TERMINAL_WRITE` and update it to use `CHANNELS.TAB_INPUT` with `{ tabId: 'default', data: '...' }` payload
  - [x] 8.2: In `ipc-handlers.test.ts`: find any test that checks the `terminalManager.onData` registration and update the assertion to use `CHANNELS.TAB_DATA` and verify the emitted payload includes `tabId`
  - [x] 8.3: In `terminal-manager.test.ts` (if it exists): update any test that calls `onData(cb)` with a single-argument callback to use the two-argument form `(tabId, data) => { ... }`
  - [x] 8.4: Run `npx vitest run src/main/` — all tests pass

## Dev Notes

### Architecture Patterns

- **This is the single intentional breaking IPC change for Phase 2** (ARCH-P2-02). All other Phase 2 IPC work is additive. Isolating this change to one story means it can be reviewed, tested, and merged independently before Epic 2 (TabManager) begins.
- **Bridge phase — hardcoded `tabId: 'default'`**: `TabManager` does not exist yet. For this story, `terminal-manager.ts` emits `tabId: 'default'` and `ipc-handlers.ts` routes `tab:input` only to the single PTY. This bridge string `'default'` is a placeholder that Epic 2 will remove when real tab IDs (`crypto.randomUUID()` / nanoid) replace it.  Do **not** store `'default'` in a constant or interface type — it is an inline temporary string to make the linter/reviewer aware it is transient.
- **`dataCallback` signature change in terminal-manager**: The callback has always been `(data: string) => void`. Changing it to `(tabId: string, data: string) => void` is an internal interface change within the main process. The only external consumer is `ipc-handlers.ts`, which registers the callback via `terminalManager.onData()`. Update both sides atomically.
- **`TerminalView` event filtering**: Even though there is only one tab in the bridge phase, the `if (payload.tabId !== tabId) return` guard must be in place from the start. This is not premature optimization — it is the architectural contract that Epic 2 depends on. Every `TerminalView` instance must only respond to its own `tabId`.
- **Listener cleanup in `useEffect`**: `TerminalView.tsx` returns a cleanup function from `useEffect`. The new `removeDataListener` (returned by `window.quakeshell.tab.onData(...)`) must be called in that cleanup just as the old one was. Failing to do so causes event handler accumulation if the component remounts.
- **`contextBridge` type safety**: In `preload/index.ts`, the `contextBridge.exposeInMainWorld` call is not type-checked against `QuakeShellAPI` at compile time (it accepts `any`). The type declaration in `ipc-types.ts` is what TypeScript uses in the renderer. After adding the `tab` namespace to `QuakeShellAPI`, the renderer will type-check tab API calls — confirm with `npx tsc --noEmit`.
- **No new IPC channels need `ipcMain.handle` stubs in this story**: `TAB_CREATE`, `TAB_CLOSE`, etc. are defined as constants in `channels.ts` but do **not** need handler registration yet. Epic 2's TabManager story will register those handlers. The preload exposes the listener helpers (`onExited`, `onAutoName`) so the renderer type-system is correct, but no main-process handler fires for them yet.

### Key Files to Create/Modify

| File | Change |
|------|--------|
| `src/shared/channels.ts` | Remove `TERMINAL_DATA`, `TERMINAL_WRITE`; add all 10 `TAB_*` channel constants |
| `src/shared/ipc-types.ts` | Add `TabDataPayload`, `TabInputPayload`, `TabExitedPayload`, `TabAutoNamePayload`, `QuakeShellTabAPI`; add `tab` field to `QuakeShellAPI`; remove `write`/`onData` from `QuakeShellTerminalAPI` |
| `src/preload/index.ts` | Add `tab` namespace; remove `terminal.write` and `terminal.onData` |
| `src/main/terminal-manager.ts` | Change `dataCallback` signature to `(tabId, data) => void`; call with `'default'` tabId |
| `src/main/ipc-handlers.ts` | Remove `TERMINAL_WRITE` handler; add `TAB_INPUT` handler; update `onData` registration to use `TAB_DATA` |
| `src/renderer/components/Terminal/TerminalView.tsx` | Add `tabId` prop; filter `tab:data` by `tabId`; replace all `terminal.write` with `tab.input` |
| `src/renderer/components/App.tsx` | Pass `tabId="default"` to `<TerminalView />` |
| `src/main/ipc-handlers.test.ts` | Update channel names and payload shapes |
| `src/main/terminal-manager.test.ts` | Update `onData` callback signature if referenced |

### Channel Naming Conventions

All channels follow `domain:action` convention. The `tab` domain owns per-session I/O and lifecycle:

| Constant | Value | Direction | Replaces |
|----------|-------|-----------|---------|
| `TAB_DATA` | `'tab:data'` | main → renderer (send) | `TERMINAL_DATA` (`'terminal:data'`) |
| `TAB_INPUT` | `'tab:input'` | renderer → main (invoke) | `TERMINAL_WRITE` (`'terminal:write'`) |
| `TAB_CREATE` | `'tab:create'` | renderer → main (invoke) | new |
| `TAB_CLOSE` | `'tab:close'` | renderer → main (invoke) | new |
| `TAB_SWITCH` | `'tab:switch'` | renderer → main (invoke) | new |
| `TAB_RENAME` | `'tab:rename'` | renderer → main (invoke) | new |
| `TAB_LIST` | `'tab:list'` | renderer → main (invoke) | new |
| `TAB_CREATE_SPLIT` | `'tab:create-split'` | renderer → main (invoke) | new |
| `TAB_EXITED` | `'tab:exited'` | main → renderer (send) | new |
| `TAB_AUTO_NAME` | `'tab:auto-name'` | main → renderer (send) | new |

### IPC Payload Shape Changes

**Before (v1):**
```typescript
// main → renderer push
TERMINAL_DATA: { data: string }

// renderer → main invoke  
TERMINAL_WRITE: { data: string }  // ipcRenderer.invoke arg
```

**After (Phase 2):**
```typescript
// main → renderer push
TAB_DATA: { tabId: string; data: string }

// renderer → main invoke
TAB_INPUT: { tabId: string; data: string }  // ipcRenderer.invoke arg
```

### What Stays Unchanged

These channels and their handlers are **not touched** in this story:

- `TERMINAL_SPAWN` / `terminal:spawn` — remains in `terminal` namespace
- `TERMINAL_RESIZE` / `terminal:resize` — remains in `terminal` namespace
- `TERMINAL_PROCESS_EXIT` / `terminal:process-exit` — remains in `terminal` namespace
- `TERMINAL_RESPAWN` / `terminal:respawn` — remains in `terminal` namespace
- All `CONFIG_*`, `WINDOW_*`, `APP_*` channels — untouched

### Single-Session Functional Verification

After this story, the app must behave identically to v1 when run with a single session. Verify manually:

1. `npm start` — app launches
2. Toggle window with hotkey — terminal appears
3. Type in terminal — input reaches shell (tab.input fires, PTY receives data)
4. Shell output appears — PTY emits data, tab:data fires, TerminalView receives and writes to xterm with matching `tabId`
5. Kill shell (type `exit`) — process-exit notification displays; Enter restarts shell

### Project Structure Notes

- `src/shared/ipc-types.ts` declares types used by BOTH `src/preload/index.ts` and `src/renderer/**`. Do not import Electron types (e.g., `IpcRendererEvent`) in this file — use `unknown` or plain types only. The preload already handles Electron-specific event wrapping internally.
- The `QuakeShellAPI` global interface declaration (`declare global { interface Window { quakeshell: QuakeShellAPI } }`) at the bottom of `ipc-types.ts` is the renderer's type contract. Adding `tab: QuakeShellTabAPI` here is all that is needed to type-check renderer code.
- `TerminalView.tsx` currently has no test file — do not create one as part of this story. The existing test coverage is in `ipc-handlers.test.ts` and `terminal-manager.test.ts`.

### References

- [Source: docs/planning-artifacts/architecture-v2.md — Decision P2-1 (TabManager & IPC refactor)]
- [Source: docs/planning-artifacts/epics-v2.md — Epic 1, Story 1.2]
- [Source: docs/planning-artifacts/epics-v2.md — ARCH-P2-01, ARCH-P2-02, ARCH-P2-03]
- [Related: src/shared/channels.ts — current channel constants]
- [Related: src/preload/index.ts — current contextBridge registration]
- [Related: src/main/terminal-manager.ts — `dataCallback` and `onData()` export]
- [Related: src/main/ipc-handlers.ts — `TERMINAL_WRITE` handler and `terminalManager.onData()` wiring]
- [Related: src/renderer/components/Terminal/TerminalView.tsx — `terminal.write` and `terminal.onData` call sites]

## File List

| Action | File |
|--------|------|
| Modified | src/shared/channels.ts |
| Modified | src/shared/ipc-types.ts |
| Modified | src/preload/index.ts |
| Modified | src/main/terminal-manager.ts |
| Modified | src/main/ipc-handlers.ts |
| Modified | src/renderer/components/Terminal/TerminalView.tsx |
| Modified | src/renderer/components/App.tsx |
| Modified | src/main/ipc-handlers.test.ts |
| Modified | src/main/terminal-manager.test.ts |
| Modified | src/renderer/components/Terminal/TerminalView.test.tsx |
| Modified | src/shared/shared.test.ts |

## Change Log

- 2026-04-04: Implemented full IPC refactor from terminal:data/terminal:write to tab:data/tab:input with tabId payload. Added 10 TAB_* channel constants, 4 payload types, QuakeShellTabAPI interface. Updated preload bridge, terminal-manager dataCallback signature, ipc-handlers routing, TerminalView event filtering with tabId prop, and all affected tests. All 360 tests pass, zero regressions.

## Dev Agent Record

### Implementation Plan
- Task 1 (channels.ts) was already completed from a prior session — TAB_* constants present, TERMINAL_DATA/WRITE deprecated as comments
- Tasks 2–7 implemented atomically: ipc-types → preload → terminal-manager → ipc-handlers → TerminalView → App
- Task 8 updated 4 test files: ipc-handlers.test.ts (added TAB_INPUT/TAB_DATA tests), terminal-manager.test.ts (two-arg callback), TerminalView.test.tsx (tab mock namespace, tabId prop), shared.test.ts (removed TERMINAL_WRITE/DATA assertions, added TAB_* assertions)

### Debug Log
- First full suite run: 24 failures — TerminalView.test.tsx missing `tab` mock namespace (23 failures), shared.test.ts expected removed TERMINAL_WRITE/DATA constants (1 failure)
- Second run: 1 failure — leftover `mockTerminalAPI.write.mockClear()` in suppress-input test
- Third run: 360/360 pass

### Completion Notes
All 8 tasks complete. Bridge phase uses hardcoded `tabId: 'default'` throughout. The app should behave identically to v1 with a single session. Epic 2 (TabManager) will replace the `'default'` placeholder with real tab IDs.
