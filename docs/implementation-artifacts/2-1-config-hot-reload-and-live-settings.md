# Story 2.1: Config Hot-Reload and Live Settings

Status: review

## Story

As a developer,
I want config file changes to apply immediately without restarting QuakeShell,
So that I can edit my JSON config and see results in real-time.

## Acceptance Criteria

1. **Given** the `config-store.ts` module is initialized with electron-store **When** the config JSON file is modified externally (e.g., saved in VS Code) **Then** electron-store detects the file change and emits a change event

2. **Given** a config file change is detected **When** the new values are read **Then** each changed key is validated against the Zod schema via `safeParse()` before being applied **And** invalid values are rejected (last-known-good value kept) and a warning is logged

3. **Given** a config value changes and passes validation **When** the change is applied in the main process **Then** a `config:changed` event is sent to the renderer via `webContents.send()` with `{ key, value, oldValue }` payload

4. **Given** the renderer receives a `config:changed` event **When** the `ConfigStore` sync-layer (Preact signals) processes it **Then** the corresponding signal is updated and all subscribed Preact components re-render with the new value

5. **Given** the `opacity` config value changes **When** the renderer receives the update **Then** the terminal window opacity is updated immediately via `window-manager.setOpacity()` without any visible flicker or restart

6. **Given** the `animationSpeed` config value changes **When** the next toggle is triggered **Then** the slide animation uses the new duration value

7. **Given** the `fontSize` or `fontFamily` config value changes **When** the renderer receives the update **Then** the xterm.js terminal instance updates its font settings and reflows content

## Tasks / Subtasks

- [x] Task 1: Add file-change watch and diff detection to config-store (AC: #1, #2)
  - [x] 1.1: Extend `src/main/config-store.ts` to leverage electron-store's built-in `onDidChange()` / `onDidAnyChange()` file-watch capabilities
  - [x] 1.2: Implement a change-detection loop that compares old vs new values per key when the config JSON is modified externally
  - [x] 1.3: For each changed key, run `configSchema.shape[key].safeParse(newValue)` to validate the individual field
  - [x] 1.4: On validation failure: keep last-known-good value, log warning via scoped logger (`log.scope('config-store').warn(...)`) with the key name and rejected value
  - [x] 1.5: On validation success: update the in-memory config cache with the new value
  - [x] 1.6: Write co-located unit test `src/main/config-store.test.ts` — test cases for: valid change detected, invalid change rejected with last-known-good preserved, multiple keys changed simultaneously

- [x] Task 2: Add `config:changed` IPC channel and broadcast mechanism (AC: #3)
  - [x] 2.1: Add `CONFIG_CHANGED: 'config:changed'` constant to `src/shared/channels.ts`
  - [x] 2.2: Define `ConfigChangedPayload` type in `src/shared/ipc-types.ts`: `{ key: string; value: unknown; oldValue: unknown }`
  - [x] 2.3: In `src/main/ipc-handlers.ts`, implement a `broadcastConfigChange(key, value, oldValue)` function that calls `webContents.send(CHANNELS.CONFIG_CHANGED, { key, value, oldValue })` on all BrowserWindow webContents
  - [x] 2.4: Wire config-store's change callback to call `broadcastConfigChange()` for each validated changed key
  - [x] 2.5: Expose `onConfigChange` listener in preload `src/preload/index.ts` via `ipcRenderer.on(CHANNELS.CONFIG_CHANGED, callback)` wrapped in the contextBridge API

- [x] Task 3: Implement renderer ConfigStore sync-layer with Preact signals (AC: #4)
  - [x] 3.1: Create `src/renderer/state/config-store.ts` — the ConfigStore sync-layer class
  - [x] 3.2: Create a Preact signal for each config key using `@preact/signals` (e.g., `signal<number>(0.85)` for opacity)
  - [x] 3.3: On initialization, call `window.quakeshell.config.getAll()` to populate all signals with current values
  - [x] 3.4: Register a `window.quakeshell.onConfigChange(({ key, value, oldValue }) => {...})` listener that updates the corresponding signal when a `config:changed` event arrives
  - [x] 3.5: Export typed accessor functions/signals for each config key (e.g., `opacity`, `animationSpeed`, `fontSize`, `fontFamily`)
  - [x] 3.6: Write co-located test `src/renderer/state/config-store.test.ts` — test that signals update when simulated `config:changed` events are received

- [x] Task 4: Wire opacity live-update through main process (AC: #5)
  - [x] 4.1: Add `setOpacity(value: number)` method to `src/main/window-manager.ts` that calls `BrowserWindow.setOpacity(value)`
  - [x] 4.2: In config-store change handler, when `opacity` key changes, call `windowManager.setOpacity(newValue)` directly in the main process
  - [x] 4.3: Ensure no flicker — opacity is set via a single `setOpacity()` call, no window recreation
  - [x] 4.4: Write unit test in `src/main/window-manager.test.ts` for `setOpacity()` — mock BrowserWindow, verify `setOpacity` called with correct value

- [x] Task 5: Wire animation speed live-update (AC: #6)
  - [x] 5.1: Ensure `src/main/window-manager.ts` reads `animationSpeed` from config-store on each `toggle()` call (not cached at startup)
  - [x] 5.2: The show animation duration should use `animationSpeed` value directly; the hide animation duration should use `animationSpeed × 0.75`
  - [x] 5.3: Write unit test verifying that changing `animationSpeed` in config-store is reflected in the next toggle call's animation duration

- [x] Task 6: Wire font settings live-update to xterm.js (AC: #7)
  - [x] 6.1: In `src/renderer/components/Terminal/TerminalView.tsx`, subscribe to `fontSize` and `fontFamily` signals from the ConfigStore sync-layer
  - [x] 6.2: When either signal changes, call `xterm.options.fontSize = newSize` and/or `xterm.options.fontFamily = newFamily`
  - [x] 6.3: After updating font options, call `fitAddon.fit()` to reflow terminal content to the new dimensions
  - [x] 6.4: Write unit test in `src/renderer/components/Terminal/TerminalView.test.tsx` — mock xterm.js instance, verify font options updated and fit() called on signal change

- [x] Task 7: Integration testing (AC: #1–#7)
  - [x] 7.1: Write integration test that simulates a full hot-reload cycle: external file change → validation → broadcast → signal update → UI effect
  - [x] 7.2: Test invalid value rejection: modify config with `opacity: 2.5` → verify last-known-good retained, warning logged
  - [x] 7.3: Test multiple simultaneous changes: modify `opacity` and `fontSize` in same file save → verify both signals update independently

## Dev Notes

### Architecture Patterns

- **electron-store file watching**: electron-store v11.0.2 provides built-in `onDidChange(key, callback)` and `onDidAnyChange(callback)` methods that detect external file modifications. These use Node.js `fs.watch` internally. The `onDidAnyChange` callback receives `(newValue, oldValue)` for the entire store, enabling per-key diffing.
- **Zod per-field validation**: Rather than re-validating the entire config on every change, validate only changed keys using the schema's `.shape` property: `configSchema.shape.opacity.safeParse(newValue)`. This allows partial updates where valid fields apply and invalid fields are rejected independently.
- **IPC broadcast pattern**: `config:changed` is a main→renderer push event (not invoke/handle). Use `webContents.send()` from `ipc-handlers.ts` — this is the established pattern from architecture Decision 1. The renderer listens via the `onConfigChange` contextBridge callback.
- **Preact signals sync-layer**: The `ConfigStore` class in `src/renderer/state/config-store.ts` owns all config signals. Components never call IPC directly — they read signals. When a `config:changed` event arrives, the sync-layer updates the signal, and Preact's fine-grained reactivity re-renders only affected components.
- **Main process side-effects**: Some config changes trigger main-process actions directly (opacity → `BrowserWindow.setOpacity()`, animationSpeed → next toggle reads new value). These are handled in the config-store change callback before/alongside the IPC broadcast.
- **No `.then()` chains**: All async operations use `async/await` per architecture enforcement.
- **Scoped loggers**: `electron-log.scope('config-store')` for all config-related logging. No `console.log`.

### Config Change Flow

```
User edits config.json in VS Code
  → electron-store detects file change (fs.watch)
  → config-store.onDidAnyChange(newConfig, oldConfig)
  → For each changed key:
      → Zod safeParse(newValue) — validate
      → If invalid: log warning, keep old value
      → If valid: update in-memory, trigger side-effects
        → Main-process effect (e.g., setOpacity)
        → ipc-handlers.broadcastConfigChange(key, value, oldValue)
          → webContents.send('config:changed', { key, value, oldValue })
  → Renderer preload receives event
  → ConfigStore sync-layer updates signal
  → Preact components re-render
```

### Dependencies

| Package | Version | Role in this story |
|---------|---------|-------------------|
| `electron-store` | 11.0.2 | File-change detection via `onDidChange`/`onDidAnyChange` |
| `zod` | 4.3.6 | Per-field `safeParse()` validation on changed keys |
| `@preact/signals` | ~1KB | Renderer-side reactive signal store for config values |
| `electron-log` | 5.4.3 | Scoped logging for validation warnings and change events |
| `vitest` | 4.1.2 | Unit and integration tests |

### Testing Standards

- **Framework**: Vitest 4.1.2
- **Co-located tests**: Next to source files (`config-store.test.ts`, `TerminalView.test.tsx`, etc.)
- **Mocking**: Mock electron-store (no real disk I/O), mock BrowserWindow for opacity tests, mock xterm.js for font tests
- **Coverage targets**: All change-detection branches, all validation paths (valid/invalid), all IPC broadcast paths, all signal update paths

### Project Structure Notes

Files to **create**:
```
src/
  renderer/
    state/
      config-store.ts         # ConfigStore sync-layer (Preact signals + IPC listener)
      config-store.test.ts    # Unit tests for ConfigStore sync-layer
```

Files to **modify**:
```
src/
  main/
    config-store.ts           # Add onDidAnyChange file-watch handler, per-key validation
    config-store.test.ts      # Add hot-reload unit tests
    window-manager.ts         # Add setOpacity() method
    window-manager.test.ts    # Add setOpacity() unit test
    ipc-handlers.ts           # Add broadcastConfigChange() function
  renderer/
    components/
      Terminal/
        TerminalView.tsx      # Subscribe to fontSize/fontFamily signals, update xterm options
        TerminalView.test.tsx # Add font live-update unit tests
  shared/
    channels.ts               # Add CONFIG_CHANGED constant
    ipc-types.ts              # Add ConfigChangedPayload type
  preload/
    index.ts                  # Add onConfigChange listener wrapper
```

### References

- Architecture: [`architecture.md`](docs/planning-artifacts/architecture.md) — IPC dual-pattern (Decision 1), Preact signals sync-layer (Decision 4), config-store pattern, channel naming convention
- PRD: [`prd.md`](docs/planning-artifacts/prd.md) — NFR22 (live settings), NFR19 (config corruption fallback)
- Epics: [`epics.md`](docs/planning-artifacts/epics.md) — Epic 2, Story 2.1
- UX Design: [`ux-design-specification.md`](docs/planning-artifacts/ux-design-specification.md) — UX-DR30 (config hot-reload)
- Story 1.2 (prerequisite): [`1-2-configuration-system-with-schema-validation.md`](docs/implementation-artifacts/1-2-configuration-system-with-schema-validation.md) — config-store module, Zod schema, IPC channels, preload config namespace
- Story 1.3 (prerequisite): [`1-3-terminal-core-powershell-via-node-pty-and-xterm-js.md`](docs/implementation-artifacts/1-3-terminal-core-powershell-via-node-pty-and-xterm-js.md) — TerminalView.tsx, xterm.js instance, font options
- Story 1.4 (prerequisite): [`1-4-window-management-toggle-animation-and-tray-icon.md`](docs/implementation-artifacts/1-4-window-management-toggle-animation-and-tray-icon.md) — window-manager.ts, toggle animation, opacity handling

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No halts or debugging issues encountered.

### Change Log

- 2026-03-31: Implemented config hot-reload system — file-watch detection, per-key Zod validation, IPC broadcast, Preact signals sync-layer, live opacity/animation/font updates. 100 tests passing (26 new).

### Completion Notes List

- Task 1: Extended `config-store.ts` with `onDidAnyChange` file-watch handler. Implemented per-key diff detection, per-field Zod validation, last-known-good preservation on invalid changes, and `ConfigChangeCallback` listener pattern. Added 8 new unit tests covering valid/invalid/multi-key changes and listener lifecycle.
- Task 2: Added `CONFIG_CHANGED` channel constant, `ConfigChangedPayload` type, `broadcastConfigChange()` function using `BrowserWindow.getAllWindows()`, wired config-store change listener to broadcast, and added `onConfigChange` to preload contextBridge.
- Task 3: Created `src/renderer/state/config-store.ts` with Preact signals for all config keys, `initConfigStore()` function that populates from main process and subscribes to `config:changed` events. Added 6 unit tests.
- Task 4: Added `setOpacity()` to window-manager.ts, wired in ipc-handlers.ts config change handler for instant opacity updates. Added 2 unit tests.
- Task 5: Refactored animation functions to read `animationSpeed` from config-store on each toggle call (show: direct value, hide: value × 0.75). Added unit test confirming config read on toggle.
- Task 6: Updated TerminalView.tsx to import config signals, added `useEffect` for live font updates (updates xterm options + reflows via fitAddon.fit()). Added 2 unit tests for font signal changes.
- Task 7: Created integration test file with 7 tests covering full hot-reload cycle, invalid value rejection with warning logging, multiple simultaneous changes, mixed valid/invalid batches, listener management, and sequential change tracking.

### File List

**New files:**
- src/renderer/state/config-store.ts
- src/renderer/state/config-store.test.ts
- src/main/config-hot-reload.integration.test.ts

**Modified files:**
- src/main/config-store.ts
- src/main/config-store.test.ts
- src/main/window-manager.ts
- src/main/window-manager.test.ts
- src/main/ipc-handlers.ts
- src/shared/channels.ts
- src/shared/ipc-types.ts
- src/preload/index.ts
- src/renderer/components/Terminal/TerminalView.tsx
- src/renderer/components/Terminal/TerminalView.test.tsx
