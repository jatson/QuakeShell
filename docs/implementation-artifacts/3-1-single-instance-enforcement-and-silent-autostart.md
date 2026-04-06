# Story 3.1: Single Instance Enforcement and Silent Autostart

Status: review

## Story

As a developer,
I want QuakeShell to start silently on Windows boot and prevent duplicate instances,
So that the terminal is always available without me launching it and I never have conflicting instances.

## Acceptance Criteria

1. **Given** the `src/main/app-lifecycle.ts` module **When** the app starts **Then** `app.requestSingleInstanceLock()` is called before any other initialization

2. **Given** the single instance lock is NOT acquired (another instance is running) **When** the second instance launches **Then** the second instance sends a signal to the first instance and exits immediately **And** the first instance's terminal window is brought into view (toggled visible if hidden)

3. **Given** the single instance lock IS acquired **When** the app initializes **Then** startup proceeds normally — tray icon appears, window is pre-created, hotkey is registered

4. **Given** the `autostart` config value is `true` (default) **When** the app starts **Then** `app.setLoginItemSettings({ openAtLogin: true, args: [] })` is called to register Windows autostart

5. **Given** the `autostart` config value is changed to `false` via JSON config **When** the hot-reload detects the change **Then** `app.setLoginItemSettings({ openAtLogin: false })` is called to remove the Windows autostart entry

6. **Given** the app starts via autostart on Windows login **When** the startup sequence completes **Then** no splash screen is shown, no tray balloon appears, no window is visible — only the tray icon is present **And** the BrowserWindow and shell process are pre-created in the background, ready for the first toggle

7. **Given** the app starts via autostart **When** cold start time is measured (boot to tray-ready) **Then** startup completes in <3 seconds (NFR6)

## Tasks / Subtasks

- [x] Task 1: Create `src/main/app-lifecycle.ts` module with single instance lock (AC: #1, #2, #3)
  - [x] 1.1: Create `src/main/app-lifecycle.ts` with a named export `initAppLifecycle()` function
  - [x] 1.2: Call `app.requestSingleInstanceLock()` as the very first operation — before any window, tray, or hotkey initialization
  - [x] 1.3: If lock is NOT acquired, call `app.quit()` immediately to exit the duplicate instance
  - [x] 1.4: Register `app.on('second-instance')` handler that calls `windowManager.toggle()` to bring the terminal into view (show if hidden)
  - [x] 1.5: If lock IS acquired, proceed with normal startup sequence: tray icon → BrowserWindow pre-creation → hotkey registration
  - [x] 1.6: Create scoped logger `log.scope('app-lifecycle')` for all lifecycle logging

- [x] Task 2: Implement Windows autostart registration (AC: #4, #5)
  - [x] 2.1: Add `autostart` field to Zod schema in `src/shared/config-schema.ts` (type: `boolean`, default: `true`)
  - [x] 2.2: In `initAppLifecycle()`, read `autostart` from config-store and call `app.setLoginItemSettings({ openAtLogin: value, args: [] })`
  - [x] 2.3: Register a config change listener for the `autostart` key in `config-store.ts` that calls `app.setLoginItemSettings({ openAtLogin: newValue })` on change
  - [x] 2.4: Wire the autostart config change handler through `ipc-handlers.ts` following the established broadcast pattern

- [x] Task 3: Implement silent startup behavior (AC: #6, #7)
  - [x] 3.1: Ensure BrowserWindow is created with `show: false` (already established in Epic 1 window-manager)
  - [x] 3.2: Verify no tray balloon notifications fire during startup — `tray-manager.ts` must not call `tray.displayBalloon()` on init
  - [x] 3.3: Pre-create the BrowserWindow and spawn the shell process in the background during startup so the first toggle is instant
  - [x] 3.4: Measure and optimize startup path to meet NFR6 (<3 seconds cold start to tray-ready)
  - [x] 3.5: Add startup timing instrumentation via scoped logger: log timestamps at key milestones (lock acquired, tray created, window pre-created, hotkey registered)

- [x] Task 4: Wire app-lifecycle into main process entry point (AC: #1–#7)
  - [x] 4.1: Modify `src/main/index.ts` to call `initAppLifecycle()` as the first operation in the `app.whenReady()` handler
  - [x] 4.2: Move existing initialization logic (tray, window, hotkey) into the lifecycle module's startup sequence
  - [x] 4.3: Add `APP_LIFECYCLE` IPC channel constants to `src/shared/channels.ts` if needed for lifecycle events

- [x] Task 5: Unit and integration testing (AC: #1–#7)
  - [x] 5.1: Create `src/main/app-lifecycle.test.ts` — test single instance lock acquisition, second-instance handler, autostart registration
  - [x] 5.2: Test that `app.requestSingleInstanceLock()` is called before any other initialization
  - [x] 5.3: Test that when lock is not acquired, `app.quit()` is called
  - [x] 5.4: Test that `second-instance` event triggers `windowManager.toggle()`
  - [x] 5.5: Test autostart config change: `true` → calls `setLoginItemSettings({ openAtLogin: true })`, `false` → calls `setLoginItemSettings({ openAtLogin: false })`
  - [x] 5.6: Test silent startup: no balloon, no visible window, tray icon present

## Dev Notes

### Architecture Patterns

- **New module `app-lifecycle.ts`**: This is a new main-process module responsible for application-level lifecycle concerns. It follows the same patterns as other main-process modules: named exports, scoped logger, async/await.
- **Single instance lock must be first**: `app.requestSingleInstanceLock()` must be called synchronously before `app.whenReady()` or any other async initialization. This is an Electron requirement — the lock must be acquired before the app event loop processes events.
- **Second-instance signal**: When a second instance launches, Electron's `app.on('second-instance')` fires on the first instance. The handler should call `windowManager.toggle()` to ensure the terminal becomes visible, providing a natural UX when a user accidentally double-launches.
- **Autostart via `setLoginItemSettings`**: Windows-specific autostart uses the registry. `app.setLoginItemSettings({ openAtLogin: true })` registers the app in `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`. The `args: []` ensures no extra arguments are passed on autostart.
- **Hot-reload integration**: The `autostart` config key change is handled by the existing hot-reload mechanism from Story 2.1. When config-store detects the change, it triggers a side-effect in the main process (similar to how `opacity` triggers `setOpacity()`).
- **Silent startup**: The app must not show any UI on boot. The BrowserWindow is pre-created with `show: false`, the shell process is spawned in the background, and only the tray icon is visible. This ensures the first toggle is instant (no cold-start delay for the user).
- **Scoped loggers**: `electron-log.scope('app-lifecycle')` — no `console.log`.
- **No `.then()` chains**: All async operations use `async/await`.

### Electron APIs

| API | Usage |
|-----|-------|
| `app.requestSingleInstanceLock()` | Acquire single instance lock (synchronous) |
| `app.on('second-instance')` | Handle signal from duplicate instance launches |
| `app.setLoginItemSettings()` | Register/unregister Windows autostart |
| `app.quit()` | Exit duplicate instances |
| `app.whenReady()` | Wait for Electron ready before initialization |
| `app.getLoginItemSettings()` | Check current autostart status (for testing/debugging) |

### Startup Sequence

```
app.requestSingleInstanceLock()
  → Lock NOT acquired? → app.quit() (exit immediately)
  → Lock acquired? → Continue:
    → app.whenReady()
      → Read config (autostart value)
      → app.setLoginItemSettings({ openAtLogin: autostart })
      → tray-manager.init() → tray icon visible
      → window-manager.init() → BrowserWindow pre-created (show: false)
      → terminal-manager.init() → shell process spawned in background
      → hotkey-manager.init() → global hotkey registered
      → Register 'second-instance' handler
      → Log startup timing
```

### Dependencies

| Package | Version | Role in this story |
|---------|---------|-------------------|
| `electron` | 36.4.0 | `app.requestSingleInstanceLock()`, `app.setLoginItemSettings()` |
| `electron-store` | 11.0.2 | Config value read for `autostart` |
| `zod` | 4.3.6 | Schema validation for `autostart` field |
| `electron-log` | 5.4.3 | Scoped lifecycle logging |
| `vitest` | 4.1.2 | Unit testing |

### Testing Standards

- **Framework**: Vitest 4.1.2
- **Co-located tests**: `src/main/app-lifecycle.test.ts` next to source
- **Mocking**: Mock `app.requestSingleInstanceLock()` return values (true/false), mock `app.setLoginItemSettings()`, mock `app.quit()`, mock `app.on('second-instance')`, mock `windowManager.toggle()`
- **Coverage targets**: All lock acquisition branches, all autostart paths, second-instance handler, startup sequence milestones

### Project Structure Notes

Files to **create**:
```
src/
  main/
    app-lifecycle.ts            # Single instance lock, autostart, startup orchestration
    app-lifecycle.test.ts       # Unit tests for app-lifecycle module
```

Files to **modify**:
```
src/
  main/
    index.ts                    # Wire initAppLifecycle() as first operation
    config-store.ts             # Add autostart change handler side-effect
    tray-manager.ts             # Verify no balloon on init
  shared/
    config-schema.ts            # Add autostart: z.boolean().default(true)
    channels.ts                 # Add lifecycle channel constants if needed
```

### References

- Architecture: [`architecture.md`](docs/planning-artifacts/architecture.md) — Main process module patterns, IPC registration, scoped loggers
- PRD: [`prd.md`](docs/planning-artifacts/prd.md) — FR2 (autostart), NFR6 (cold start <3s), NFR18 (single instance)
- Epics: [`epics.md`](docs/planning-artifacts/epics.md) — Epic 3, Story 3.1
- UX Design: [`ux-design-specification.md`](docs/planning-artifacts/ux-design-specification.md) — Silent startup behavior
- Story 1.4 (prerequisite): [`1-4-window-management-toggle-animation-and-tray-icon.md`](docs/implementation-artifacts/1-4-window-management-toggle-animation-and-tray-icon.md) — window-manager.ts, tray-manager.ts, toggle(), show: false
- Story 2.1 (prerequisite): [`2-1-config-hot-reload-and-live-settings.md`](docs/implementation-artifacts/2-1-config-hot-reload-and-live-settings.md) — Config hot-reload mechanism, config change handlers

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 via GitHub Copilot

### Debug Log References
- All 186 tests pass (14 files), 0 regressions
- 12 new tests in app-lifecycle.test.ts all pass
- No TypeScript errors in changed files

### Completion Notes List
- Created `app-lifecycle.ts` with `initAppLifecycle()`, `applyAutostart()`, `registerAutostartConfigHandler()`, `logMilestone()`
- Single instance lock acquired synchronously before `app.whenReady()` — Electron requirement satisfied
- Second-instance handler calls `windowManager.toggle()` to bring terminal into view
- Autostart handled via `app.setLoginItemSettings()` with config hot-reload support
- Rewired `index.ts` startup: lock → config → autostart → tray → window → shell pre-spawn → focus-fade → hotkey → IPC
- Added startup timing instrumentation with `logMilestone()` at each key phase
- Shell pre-spawned during startup for instant first toggle
- Silent startup verified: window `show: false`, no `displayBalloon()` in tray-manager
- `autostart` field already existed in config-schema.ts (z.boolean().default(true))
- Autostart config change side-effect wired in both `app-lifecycle.ts` and `ipc-handlers.ts`
- No new IPC channel constants needed — existing APP_QUIT/APP_GET_VERSION placeholders sufficient

### File List
- `src/main/app-lifecycle.ts` (NEW) — single instance lock, autostart, startup orchestration
- `src/main/app-lifecycle.test.ts` (NEW) — 12 unit tests
- `src/main/index.ts` (MODIFIED) — rewired to use initAppLifecycle(), added autostart, shell pre-spawn, timing
- `src/main/ipc-handlers.ts` (MODIFIED) — added autostart config change side-effect

### Change Log
- 2026-03-31: Implemented Story 3.1 — single instance enforcement, silent autostart, startup timing instrumentation
