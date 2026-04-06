# Story 3.6: Windows Notifications and Update Checking

Status: review

## Story

As a developer,
I want QuakeShell to notify me when a terminal event needs attention and when updates are available,
So that I don't miss important terminal output and can keep QuakeShell up to date.

## Acceptance Criteria

1. **Given** the `src/main/notification-manager.ts` module **When** a terminal event requires user attention (e.g., a background process requests input while the terminal is hidden) **Then** a Windows toast notification is displayed with the event description

2. **Given** a Windows toast notification is displayed **When** the user clicks the notification **Then** the terminal is toggled visible (brought into view) and focused

3. **Given** the terminal is currently visible and focused **When** a notification-worthy event occurs **Then** no toast notification is sent — notifications only trigger when the terminal is hidden or unfocused

4. **Given** the `src/main/app-lifecycle.ts` periodic update check **When** the app has been running and the check interval elapses (default: every 24 hours) **Then** the system checks the npm registry for a newer version of the QuakeShell package

5. **Given** a newer version is found on npm **When** the update check completes **Then** a Windows tray notification is displayed: "QuakeShell vX.Y.Z available. Update now?" **And** the notification does not block or interrupt the user's terminal workflow

6. **Given** no newer version is found **When** the update check completes **Then** nothing visible happens — no notification, no log at info level (only verbose)

7. **Given** the update check fails (no network, npm registry unreachable) **When** the check completes with an error **Then** the failure is logged at verbose level and no error is shown to the user — the app continues operating normally (fully offline capable)

8. **Given** the user clicks "Check for Updates" from the tray context menu **When** the manual check runs **Then** if an update is found, the notification is shown; if no update, a brief tray notification says "QuakeShell is up to date"

## Tasks / Subtasks

- [x] Task 1: Create notification-manager module (AC: #1, #2, #3)
  - [x] 1.1: Create `src/main/notification-manager.ts` with named exports and scoped logger `log.scope('notification-manager')`
  - [x] 1.2: Implement `send(options: NotificationOptions): void` function that creates and shows a Windows toast notification via Electron's `Notification` class
  - [x] 1.3: Define `NotificationOptions` type: `{ title: string; body: string; onClick?: () => void }`
  - [x] 1.4: In `send()`, register a `notification.on('click')` handler that calls the provided `onClick` callback (default: `windowManager.toggle()` to show the terminal)
  - [x] 1.5: Before sending a notification, check if the terminal window is visible and focused via `windowManager.isVisible()` and `BrowserWindow.isFocused()` — if so, skip the notification (AC #3)
  - [x] 1.6: Export `isNotificationSuppressed(): boolean` helper that returns `true` when the terminal is visible and focused

- [x] Task 2: Implement terminal event notifications (AC: #1, #2, #3)
  - [x] 2.1: Define notification-worthy terminal events: shell crash (from Story 3.4), bell character received (`\x07`), and process requesting input while hidden
  - [x] 2.2: For bell character: in `terminal-manager.ts`, detect `\x07` in the PTY data stream and trigger a notification if the terminal is hidden
  - [x] 2.3: For shell crash: the handler from Story 3.4 already calls `notificationManager.send()` — verify integration
  - [x] 2.4: Each notification click brings the terminal into view by calling `windowManager.toggle()` (or `windowManager.show()` if already in the correct state)
  - [x] 2.5: Not needed — notification click handled entirely in main process via onClick callback

- [x] Task 3: Implement periodic update check (AC: #4, #5, #6, #7)
  - [x] 3.1: Create `checkForUpdates(manual?: boolean): Promise<UpdateCheckResult>` function in `src/main/notification-manager.ts`
  - [x] 3.2: Define `UpdateCheckResult` type: `{ updateAvailable: boolean; currentVersion: string; latestVersion: string | null; error?: string }`
  - [x] 3.3: Implement the npm registry check: `fetch('https://registry.npmjs.org/quakeshell/latest')` and parse the `version` field from the response JSON
  - [x] 3.4: Compare the registry version with `app.getVersion()` using semver comparison (simple string split and numeric compare)
  - [x] 3.5: If a newer version is found, display a tray notification: `"QuakeShell v${latestVersion} available. Update now?"`
  - [x] 3.6: If no newer version is found and `manual` is `false` (periodic check), do nothing visible — log at verbose level only
  - [x] 3.7: If no newer version is found and `manual` is `true` (user clicked "Check for Updates"), show a brief notification: `"QuakeShell is up to date"`

- [x] Task 4: Implement periodic update check timer (AC: #4)
  - [x] 4.1: In `src/main/app-lifecycle.ts`, set up a `setInterval()` timer to call `checkForUpdates(false)` every 24 hours (86400000 ms)
  - [x] 4.2: Run the first update check 5 minutes after startup (300000 ms delay) to avoid slowing down boot
  - [x] 4.3: Store the timer reference for cleanup during graceful shutdown
  - [x] 4.4: Clear the interval timer in the `gracefulShutdown()` function

- [x] Task 5: Handle update check errors gracefully (AC: #7)
  - [x] 5.1: Wrap the `fetch()` call in a try/catch block
  - [x] 5.2: On network error (fetch fails), log at verbose level: `log.scope('update-checker').verbose('Update check failed: ${error.message}')`
  - [x] 5.3: On JSON parse error, log at verbose level and return `{ updateAvailable: false, error: 'Invalid response' }`
  - [x] 5.4: Set a fetch timeout of 10 seconds using `AbortController` to prevent hanging on slow networks
  - [x] 5.5: Never show an error notification to the user for failed update checks — the app is fully offline capable

- [x] Task 6: Wire "Check for Updates" tray menu action (AC: #8)
  - [x] 6.1: Export `checkForUpdates(manual: true)` as the handler for the tray context menu "Check for Updates" item (wired in Story 3.3)
  - [x] 6.2: When manual check finds an update, show the same notification as the periodic check
  - [x] 6.3: When manual check finds no update, show a brief tray notification: "QuakeShell is up to date" (only for manual checks)

- [x] Task 7: Wire notification-manager to IPC and preload (AC: #1–#8)
  - [x] 7.1: Register notification-related IPC handlers in `src/main/ipc-handlers.ts`
  - [x] 7.2: Bell character detection handled in main process via `terminal-manager.onBell()` — no renderer IPC needed
  - [x] 7.3: Not needed — all notifications originate from main process

- [x] Task 8: Unit and integration testing (AC: #1–#8)
  - [x] 8.1: Created `src/main/notification-manager.test.ts` with 16 tests covering send(), suppression, click handlers, update checking
  - [x] 8.2: Update checker tests: newer version, same version (periodic + manual), network error, HTTP error, semver comparison
  - [x] 8.3: Periodic timer tested in `app-lifecycle.test.ts` (setInterval with 24h, setTimeout with 5min delay)
  - [x] 8.4: Manual check trigger tested via tray-manager integration

## Dev Notes

### Architecture Patterns

- **New module `notification-manager.ts`**: Centralizes all notification logic. Other modules (terminal-manager, update-checker) call `notificationManager.send()` rather than creating Notification instances directly. This ensures consistent behavior (suppression when visible, click-to-show).
- **Notification suppression**: Notifications are ONLY shown when the terminal is hidden or unfocused. This prevents distracting the user while they're actively working in the terminal. The `isNotificationSuppressed()` check runs before every notification send.
- **Update check via npm registry**: A simple HTTP fetch to `https://registry.npmjs.org/{package}/latest` returns package metadata including the `version` field. No npm CLI or electron-updater dependency required. This is a lightweight check-and-notify approach — the user updates manually via their package manager.
- **Semver comparison**: For MVP, a simple string split and numeric comparison of major.minor.patch is sufficient. No need for a semver library. If the registry version is higher than `app.getVersion()`, an update is available.
- **Offline-first**: The update check is entirely optional. Network failures are silently logged at verbose level. The app never shows error UI for update check failures. This ensures the app works perfectly in offline/air-gapped environments.
- **Timer management**: The periodic update check uses `setInterval`. The timer reference is stored for cleanup during graceful shutdown (Story 3.3). The first check is delayed 5 minutes after startup to avoid competing with the critical startup path.
- **Scoped loggers**: `log.scope('notification-manager')` and `log.scope('update-checker')` — no `console.log`.

### Notification Flow

```
Terminal Event (e.g., shell crash while hidden)
  → notificationManager.send({
      title: 'QuakeShell',
      body: 'Shell process exited unexpectedly',
      onClick: () => windowManager.toggle()
    })
    → isNotificationSuppressed()? → YES: skip
    → NO: new Notification({ title, body }).show()
    → User clicks notification → windowManager.toggle()
```

### Update Check Flow

```
Periodic timer (every 24h) OR manual menu click
  → checkForUpdates(manual)
    → fetch('https://registry.npmjs.org/quakeshell/latest')
      → Success:
        → Parse version from JSON
        → Compare with app.getVersion()
        → Newer? → Show notification: "QuakeShell vX.Y.Z available"
        → Same? → manual ? Show "Up to date" : Do nothing
      → Error:
        → log.verbose('Update check failed: ...')
        → Return { updateAvailable: false, error: message }
```

### Electron APIs

| API | Usage |
|-----|-------|
| `new Notification({ title, body })` | Create Windows toast notification |
| `notification.show()` | Display the notification |
| `notification.on('click')` | Handle notification click to show terminal |
| `app.getVersion()` | Get current app version for comparison |
| `BrowserWindow.isFocused()` | Check if terminal has focus (suppression) |
| `BrowserWindow.isVisible()` | Check if terminal is visible (suppression) |

### Dependencies

| Package | Version | Role in this story |
|---------|---------|-------------------|
| `electron` | 36.4.0 | `Notification` API, `app.getVersion()`, `BrowserWindow` focus checks |
| `electron-log` | 5.4.3 | Scoped logging for notifications and update checks |
| `vitest` | 4.1.2 | Unit testing |
| (No external packages) | — | Update check uses Node.js built-in `fetch()` (available in Electron's Node.js) |

### Testing Standards

- **Framework**: Vitest 4.1.2
- **Co-located tests**: `src/main/notification-manager.test.ts` next to source
- **Mocking**: Mock Electron `Notification` constructor, mock `notification.show()` and `notification.on('click')`, mock `fetch()` for npm registry responses, mock `app.getVersion()`, mock `windowManager.isVisible()` and `BrowserWindow.isFocused()`, mock `setInterval`/`clearInterval`
- **Coverage targets**: All notification send paths, suppression logic, all update check outcomes (newer/same/error/timeout), periodic vs manual check behavior, timer setup and cleanup

### Project Structure Notes

Files to **create**:
```
src/
  main/
    notification-manager.ts       # Windows toast notifications, update checking
    notification-manager.test.ts  # Unit tests for notification and update logic
```

Files to **modify**:
```
src/
  main/
    app-lifecycle.ts              # Add periodic update check timer, cleanup on shutdown
    terminal-manager.ts           # Wire bell character detection to notification-manager
    ipc-handlers.ts               # Register notification-related IPC handlers
  shared/
    channels.ts                   # Add notification channel constants if needed
    ipc-types.ts                  # Add NotificationOptions, UpdateCheckResult types
```

### References

- Architecture: [`architecture.md`](docs/planning-artifacts/architecture.md) — Main process module patterns, error handling, scoped loggers
- PRD: [`prd.md`](docs/planning-artifacts/prd.md) — FR33 (Windows notifications), FR34 (update checking), NFR17 (crash notification)
- Epics: [`epics.md`](docs/planning-artifacts/epics.md) — Epic 3, Story 3.6
- UX Design: [`ux-design-specification.md`](docs/planning-artifacts/ux-design-specification.md) — Notification behavior, update prompt UX
- Story 3.1 (dependency): [`3-1-single-instance-enforcement-and-silent-autostart.md`](docs/implementation-artifacts/3-1-single-instance-enforcement-and-silent-autostart.md) — app-lifecycle.ts module for timer integration
- Story 3.3 (dependency): [`3-3-tray-interactions-and-context-menu.md`](docs/implementation-artifacts/3-3-tray-interactions-and-context-menu.md) — "Check for Updates" tray menu item, graceful shutdown timer cleanup
- Story 3.4 (dependency): [`3-4-shell-crash-recovery-and-exit-handling.md`](docs/implementation-artifacts/3-4-shell-crash-recovery-and-exit-handling.md) — Shell crash notification integration

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
{{VSCODE_TARGET_SESSION_LOG}}

### Completion Notes List
- Created `src/main/notification-manager.ts` with `send()`, `isNotificationSuppressed()`, `checkForUpdates()`, and `isNewerVersion()` — centralized notification logic with suppression when visible+focused
- Added `onBell()` callback to `src/main/terminal-manager.ts` — detects `\x07` in PTY data stream and fires callback
- Wired bell notification in `src/main/ipc-handlers.ts` via `terminalManager.onBell()` → `notificationManager.send()`
- Crash notification (from Story 3.4) refactored to use `notificationManager.send()` for consistent suppression behavior
- `checkForUpdates()` uses 10s `AbortController` timeout, simple semver comparison, handles all error cases gracefully
- Periodic update check timer in `src/main/app-lifecycle.ts` — 5min initial delay, 24h interval, cleanup on graceful shutdown
- "Check for Updates" tray menu item wired in `src/main/tray-manager.ts` → `notificationManager.checkForUpdates(true)`
- 256 total tests pass (230 main/shared + 26 renderer), zero regressions

### File List
- `src/main/notification-manager.ts` — Created: notification send, suppression, update checking
- `src/main/notification-manager.test.ts` — Created: 16 tests
- `src/main/terminal-manager.ts` — Modified: added `onBell()`, bell detection in data stream
- `src/main/terminal-manager.test.ts` — Modified: 3 new bell tests, fixed data callback test
- `src/main/ipc-handlers.ts` — Modified: bell notification wiring, crash notification via notificationManager
- `src/main/ipc-handlers.test.ts` — Modified: notification-manager mock, updated notification assertions
- `src/main/app-lifecycle.ts` — Modified: periodic update check timer (already done in prior session)
- `src/main/tray-manager.ts` — Modified: Check for Updates menu wiring (already done in prior session)
