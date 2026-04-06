# Story 2.3: Hotkey Remapping with Conflict Detection

Status: review

## Story

As a developer,
I want to change my global hotkey via JSON config and be warned if it conflicts,
So that I can resolve conflicts with other applications and use my preferred shortcut.

## Acceptance Criteria

1. **Given** the `hotkey` config value is changed in the JSON file **When** the hot-reload detects the change **Then** `hotkey-manager.ts` unregisters the old global shortcut and attempts to register the new one

2. **Given** the new hotkey registration succeeds **When** `globalShortcut.register()` returns `true` **Then** the new hotkey is active immediately, the success is logged, and the old hotkey no longer triggers the toggle

3. **Given** the new hotkey registration fails (conflict with another application) **When** `globalShortcut.register()` returns `false` **Then** a warning is logged via the scoped logger with the conflicting hotkey string **And** the tray icon left-click remains functional as a fallback toggle method **And** the system does not crash or enter an unusable state

4. **Given** a hotkey conflict has occurred **When** the user edits the config again with a different hotkey **Then** the system attempts registration of the new hotkey on the next hot-reload cycle

5. **Given** the app starts for the first time **When** the configured hotkey (default `Ctrl+Shift+Q`) is registered **Then** if registration fails, the app starts normally with tray-only toggle and logs a warning

## Tasks / Subtasks

- [x] Task 1: Implement hotkey re-registration on config change (AC: #1, #2)
  - [x] 1.1: In `src/main/hotkey-manager.ts`, add a `reregister(oldHotkey: string, newHotkey: string)` method
  - [x] 1.2: The `reregister()` method must first call `globalShortcut.unregister(oldHotkey)` to release the old shortcut
  - [x] 1.3: Then call `globalShortcut.register(newHotkey, toggleCallback)` to attempt the new registration
  - [x] 1.4: If `globalShortcut.isRegistered(newHotkey)` returns `true` after registration, log success via `log.scope('hotkey').info('Hotkey registered: ${newHotkey}')` and update the internal `currentHotkey` state
  - [x] 1.5: Store the current active hotkey string internally so it can be unregistered on the next change
  - [x] 1.6: Write co-located unit test `src/main/hotkey-manager.test.ts` — mock `globalShortcut`, verify unregister called with old key, register called with new key, currentHotkey updated on success

- [x] Task 2: Wire hotkey change to config-store hot-reload handler (AC: #1)
  - [x] 2.1: In the config-store change handler (from Story 2.1), detect `hotkey` key changes
  - [x] 2.2: When `hotkey` changes, call `hotkeyManager.reregister(oldValue, newValue)`
  - [x] 2.3: Broadcast `config:changed` event to renderer for signal update (the renderer ConfigStore updates its `hotkey` signal)
  - [x] 2.4: Write unit test verifying that a config change for `hotkey` triggers `reregister()` with correct old/new values

- [x] Task 3: Implement conflict detection and graceful fallback (AC: #3)
  - [x] 3.1: In `reregister()`, after calling `globalShortcut.register()`, check `globalShortcut.isRegistered(newHotkey)` — if `false`, the registration failed due to a conflict
  - [x] 3.2: On failure: log a warning via `log.scope('hotkey').warn('Hotkey registration failed — conflict detected: ${newHotkey}')` with the attempted hotkey string
  - [x] 3.3: On failure: set an internal `conflictState` flag with the attempted hotkey string — this allows the system to track that it is operating in degraded mode
  - [x] 3.4: On failure: do NOT crash, do NOT re-throw — the app continues operating with tray icon left-click as the fallback toggle method
  - [x] 3.5: On failure: do NOT revert the config value — the user's intended hotkey remains in config.json so they can see what they tried
  - [x] 3.6: Ensure the tray manager's left-click toggle (`tray-manager.ts`) remains fully functional regardless of hotkey state — this is the guaranteed fallback
  - [x] 3.7: Write unit test: mock `globalShortcut.register()` to return `false` → verify warning logged, no crash, `conflictState` set, tray toggle still works

- [x] Task 4: Handle retry after conflict (AC: #4)
  - [x] 4.1: When a new hotkey change arrives after a conflict, `reregister()` must still attempt the old unregister (even though the old key may not be registered due to conflict)
  - [x] 4.2: `globalShortcut.unregister()` is safe to call with an unregistered key — it's a no-op
  - [x] 4.3: Clear the `conflictState` flag before attempting the new registration
  - [x] 4.4: If the new registration succeeds, the system recovers from degraded mode automatically
  - [x] 4.5: Write unit test: simulate conflict → change to different hotkey → verify new registration attempted → if succeeds, conflictState cleared

- [x] Task 5: Handle startup registration failure (AC: #5)
  - [x] 5.1: In `src/main/hotkey-manager.ts`, the `register(hotkey: string, toggleCallback: () => void)` method (called on app startup from Story 1.4) already exists
  - [x] 5.2: Verify that the existing startup registration path handles failure gracefully: if `globalShortcut.register()` fails on startup, log a warning and continue
  - [x] 5.3: Ensure the app completes initialization even if the hotkey fails — tray icon, BrowserWindow, terminal process all initialize normally
  - [x] 5.4: Set `conflictState` on startup failure so the system knows it's in degraded mode from the start
  - [x] 5.5: Write unit test: mock `globalShortcut.register()` to fail at startup → verify app initializes without crash, tray is functional, warning logged

- [x] Task 6: Cleanup on app quit (AC: #1, #2)
  - [x] 6.1: Ensure `globalShortcut.unregisterAll()` is called during app shutdown (in `app-lifecycle.ts` or via `app.on('will-quit')`)
  - [x] 6.2: This prevents orphaned global shortcuts on app exit
  - [x] 6.3: Write unit test verifying `unregisterAll()` called on app quit

- [x] Task 7: Integration testing (AC: #1–#5)
  - [x] 7.1: Write integration test: full remap cycle — start with `Ctrl+Shift+Q` → change config to `Ctrl+Shift+T` → verify old unregistered, new registered, toggle works with new key
  - [x] 7.2: Write integration test: conflict scenario — register conflicting key → verify warning logged, tray fallback works → change to non-conflicting key → verify recovery
  - [x] 7.3: Write integration test: startup failure → verify tray toggle operational as fallback

## Dev Notes

### Architecture Patterns

- **globalShortcut API**: Electron's `globalShortcut.register(accelerator, callback)` returns `void` but `globalShortcut.isRegistered(accelerator)` returns `boolean` to check success. If another application has already registered the accelerator at the OS level, `isRegistered()` returns `false` after `register()`. This is the conflict detection mechanism.
- **Accelerator format**: Electron uses Chromium accelerator format: `Ctrl+Shift+Q`, `Alt+Space`, `CommandOrControl+K`. The hotkey string from config.json must match this format. Invalid accelerator strings will throw — wrap in try/catch.
- **Single IPC registration point**: `ipc-handlers.ts` wires the hotkey manager. The hotkey manager itself does NOT import `ipcMain` — it exposes `register()`, `reregister()`, and `unregisterAll()` methods.
- **Tray fallback guarantee**: `tray-manager.ts` always registers a left-click handler on the tray icon that calls `windowManager.toggle()`. This is independent of the global shortcut system — it always works regardless of hotkey state.
- **Scoped logger**: `electron-log.scope('hotkey')` for all hotkey-related logging.
- **No `.then()` chains**: All async operations use `async/await`.

### Hotkey Re-registration Flow

```
User edits config.json: hotkey: "Ctrl+Shift+T"
  → electron-store detects change
  → config-store change handler: hotkey changed from "Ctrl+Shift+Q" to "Ctrl+Shift+T"
  → hotkeyManager.reregister("Ctrl+Shift+Q", "Ctrl+Shift+T")
    → globalShortcut.unregister("Ctrl+Shift+Q")  ← old key released
    → try { globalShortcut.register("Ctrl+Shift+T", toggle) }
    → globalShortcut.isRegistered("Ctrl+Shift+T")
      → true: log success, update currentHotkey, clear conflictState
      → false: log warning, set conflictState, tray fallback active
  → ipc-handlers.broadcastConfigChange("hotkey", "Ctrl+Shift+T", "Ctrl+Shift+Q")
  → Renderer ConfigStore updates hotkey signal
```

### Conflict State

```typescript
// src/main/hotkey-manager.ts
interface HotkeyState {
  currentHotkey: string | null;     // Currently registered hotkey (null if conflict)
  configuredHotkey: string;          // What the user wants (may not be registered)
  conflictState: string | null;      // The hotkey string that failed, null if no conflict
}
```

### Dependencies

| Package | Version | Role in this story |
|---------|---------|-------------------|
| `electron` | 41.1.0 | `globalShortcut.register()`, `globalShortcut.unregister()`, `globalShortcut.isRegistered()` |
| `electron-store` | 11.0.2 | Hot-reload detection for `hotkey` config key |
| `electron-log` | 5.4.3 | Scoped logging for registration success/failure/conflict |
| `vitest` | 4.1.2 | Unit and integration tests |

### Testing Standards

- **Framework**: Vitest 4.1.2
- **Co-located tests**: `src/main/hotkey-manager.test.ts`
- **Mocking**: Mock `globalShortcut` (register, unregister, isRegistered), mock config-store for initial hotkey value, mock tray-manager to verify fallback still works
- **Coverage targets**: All registration paths (success, conflict), all unregister paths (old key, cleanup), startup failure, retry after conflict, invalid accelerator string handling
- **Edge cases to test**: Empty hotkey string, malformed accelerator (should not crash), same hotkey re-registered (no-op), rapid consecutive hotkey changes

### Project Structure Notes

Files to **create**:
```
(No new files — this story extends existing modules)
```

Files to **modify**:
```
src/
  main/
    hotkey-manager.ts         # Add reregister(), conflictState tracking, try/catch around register
    hotkey-manager.test.ts    # Add re-registration, conflict detection, fallback, and recovery tests
    config-store.ts           # Wire hotkey change handler in the hot-reload callback (extends Story 2.1)
    app-lifecycle.ts          # Ensure globalShortcut.unregisterAll() on will-quit
```

### References

- Architecture: [`architecture.md`](docs/planning-artifacts/architecture.md) — hotkey-manager module, globalShortcut pattern, graceful degradation principle
- PRD: [`prd.md`](docs/planning-artifacts/prd.md) — FR14 (configurable hotkey), FR25 (hotkey remapping), FR26 (conflict detection), FR27 (graceful failure with fallback)
- Epics: [`epics.md`](docs/planning-artifacts/epics.md) — Epic 2, Story 2.3
- Story 1.4 (prerequisite): [`1-4-window-management-toggle-animation-and-tray-icon.md`](docs/implementation-artifacts/1-4-window-management-toggle-animation-and-tray-icon.md) — hotkey-manager.ts initial implementation, tray-manager.ts left-click toggle, window-manager.toggle()
- Story 2.1 (dependency): [`2-1-config-hot-reload-and-live-settings.md`](docs/implementation-artifacts/2-1-config-hot-reload-and-live-settings.md) — hot-reload infrastructure, config-store change handler, config:changed broadcast

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Added `reregister(oldHotkey, newHotkey)` method to hotkey-manager.ts with full conflict detection
- Added `conflictState` tracking — set on failure, cleared on success, exposed via `getConflictState()`
- Added `getRegisteredAccelerator()` and `_reset()` for state inspection and testing
- Updated `registerHotkey()` to store callback and set conflictState on failure/exception
- Wired hotkey config change in ipc-handlers.ts → calls `hotkeyManager.reregister(oldValue, newValue)`
- Startup failure already handled: app continues with tray fallback, conflictState set
- Cleanup on quit already handled: `will-quit` → `unregisterAll()` in index.ts
- 20 unit tests + 5 integration tests, 146 total tests pass, 0 regressions

### File List

- src/main/hotkey-manager.ts (modified — added reregister(), conflictState, getConflictState(), getRegisteredAccelerator(), _reset())
- src/main/hotkey-manager.test.ts (modified — added reregister tests, conflict state tests, accessor tests)
- src/main/ipc-handlers.ts (modified — added hotkeyManager import and hotkey change handler)
- src/main/hotkey-remap.integration.test.ts (created — full remap cycle, conflict recovery, startup failure, rapid changes, invalid accelerator)
