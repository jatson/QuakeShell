# Story 3.4: Shell Crash Recovery and Exit Handling

Status: review

## Story

As a developer,
I want QuakeShell to recover automatically when my shell crashes and show me what happened,
So that I never lose my terminal and can quickly get back to work.

## Acceptance Criteria

1. **Given** a running shell process in the terminal **When** the shell process exits normally (exit code 0, e.g., user types `exit`) **Then** the terminal displays the last output followed by `[Process exited with code 0]` in dimmed text (`--fg-dimmed` / `#565f89`)

2. **Given** a running shell process **When** the shell process crashes (non-zero exit code) **Then** the terminal displays the last output followed by `[Process exited with code N]` in dimmed text **And** the crash is logged via the scoped logger with the exit code and signal

3. **Given** the terminal is showing a `[Process exited]` message **When** the user presses Enter **Then** a new shell process is spawned in the same session using the configured default shell **And** the terminal is ready for input

4. **Given** a shell crash occurs **When** the terminal is currently hidden **Then** a Windows toast notification is sent: "QuakeShell: Shell process exited unexpectedly" **And** clicking the notification brings the terminal into view

5. **Given** the terminal session with an exited shell **When** the user does not press Enter to restart **Then** the session remains in its exited state — no auto-restart loop, user controls when to restart

## Tasks / Subtasks

- [x] Task 1: Implement shell exit detection in terminal-manager (AC: #1, #2)
  - [x] 1.1: In `src/main/terminal-manager.ts`, register a handler on the node-pty `onExit` event: `pty.onExit(({ exitCode, signal }) => { ... })`
  - [x] 1.2: When exit is detected, determine if it's a normal exit (code 0) or a crash (non-zero code)
  - [x] 1.3: Send an IPC message to the renderer with the exit information: `{ exitCode, signal, isNormalExit: exitCode === 0 }`
  - [x] 1.4: Log the exit event via `log.scope('terminal-manager')` — for normal exit use `info` level, for crash use `warn` level with exit code and signal details
  - [x] 1.5: Add `TERMINAL_PROCESS_EXIT` channel constant to `src/shared/channels.ts`
  - [x] 1.6: Define `TerminalProcessExitPayload` type in `src/shared/ipc-types.ts`: `{ exitCode: number; signal: number; isNormalExit: boolean }`

- [x] Task 2: Render exit message in dimmed text on the renderer (AC: #1, #2)
  - [x] 2.1: In `src/renderer/components/Terminal/TerminalView.tsx`, listen for the `TERMINAL_PROCESS_EXIT` IPC event via the preload bridge
  - [x] 2.2: When received, write the exit message to xterm.js using ANSI escape codes for dimmed color: `\x1b[38;2;86;95;137m[Process exited with code ${exitCode}]\x1b[0m`
  - [x] 2.3: Write a newline before the message to ensure it appears on a new line after the last shell output
  - [x] 2.4: Set the terminal session state to `'exited'` to track that the shell is no longer running

- [x] Task 3: Implement Enter-to-restart behavior (AC: #3, #5)
  - [x] 3.1: When the terminal session state is `'exited'`, intercept keyboard input in the renderer
  - [x] 3.2: Register an `xterm.onData` handler that checks if the pressed key is Enter (`\r`) while the session is in `'exited'` state
  - [x] 3.3: On Enter press: send an IPC invoke to the main process to spawn a new shell process via `TERMINAL_RESPAWN`
  - [x] 3.4: In ipc-handlers `TERMINAL_RESPAWN`, spawn a new shell process using the configured `defaultShell` and reconnect it to the existing xterm.js instance via the data channel
  - [x] 3.5: After respawn, reset the terminal session state to `'running'` and clear the key interception
  - [x] 3.6: While in `'exited'` state, suppress all other keyboard input to prevent characters from being written to the dead PTY
  - [x] 3.7: Add `TERMINAL_RESPAWN` channel constant to `src/shared/channels.ts`

- [x] Task 4: Send crash notification when terminal is hidden (AC: #4)
  - [x] 4.1: In the `onExit` handler in `ipc-handlers.ts`, when `exitCode !== 0` (crash), check if the BrowserWindow is currently visible via `windowManager.isVisible()`
  - [x] 4.2: If the window is hidden, use Electron's `Notification` API directly (stub until Story 3.6)
  - [x] 4.3: Register a click handler on the notification that calls `windowManager.toggle()` to bring the terminal into view
  - [x] 4.4: Using Electron's `Notification` API directly as Story 3.6 is not yet implemented
  - [x] 4.5: If the window is already visible and focused, do NOT send a notification — the user can see the exit message directly

- [x] Task 5: Expose exit handling through preload bridge (AC: #1–#5)
  - [x] 5.1: In `src/preload/index.ts`, expose `onProcessExit(callback)` via contextBridge that listens for `TERMINAL_PROCESS_EXIT` events
  - [x] 5.2: Expose `respawnShell()` invoke via contextBridge that calls `ipcRenderer.invoke(CHANNELS.TERMINAL_RESPAWN)`
  - [x] 5.3: Register the `TERMINAL_RESPAWN` handler in `src/main/ipc-handlers.ts` following the single registration point pattern

- [x] Task 6: Unit and integration testing (AC: #1–#5)
  - [x] 6.1: Created `src/main/ipc-handlers.test.ts` with exit handling tests (exit detection moved to ipc-handlers)
  - [x] 6.2: Extended `src/renderer/components/Terminal/TerminalView.test.tsx`:
    - Test dimmed exit message written to xterm.js buffer with correct ANSI codes
    - Test Enter key triggers respawn IPC call when session is in `'exited'` state
    - Test other keys suppressed in `'exited'` state
    - Test session state transitions: `'running'` → `'exited'` → `'running'` on respawn
  - [x] 6.3: Test notification on hidden crash: mock windowManager.isVisible() = false, verify notification sent
  - [x] 6.4: Test no notification on visible crash: mock windowManager.isVisible() = true, verify no notification

## Dev Notes

### Architecture Patterns

- **PTY exit event pipeline**: node-pty fires `onExit({ exitCode, signal })` when the shell process terminates. The terminal-manager catches this event, logs it, and sends an IPC push to the renderer. The renderer displays the exit message and enters the `'exited'` state.
- **Session state machine**: The terminal session has two states: `'running'` (normal operation, keyboard input forwarded to PTY) and `'exited'` (shell dead, keyboard input intercepted, only Enter triggers respawn). This prevents zombie input and auto-restart loops.
- **Dimmed text via ANSI escape**: The exit message uses inline ANSI SGR codes to set the color to `#565f89` (the `--fg-dimmed` design token): `\x1b[38;2;86;95;137m`. The reset code `\x1b[0m` follows the message. This approach works universally in xterm.js without requiring CSS changes.
- **Respawn reuses existing xterm instance**: When the user presses Enter to restart, a new PTY process is spawned and its data stream is connected to the existing xterm.js instance. The terminal is NOT cleared — the old output and exit message remain visible, and the new shell starts below them.
- **No auto-restart loop**: AC #5 explicitly requires that the shell does NOT auto-restart. The user must press Enter. This prevents infinite restart loops when a shell configuration is broken (e.g., invalid custom shell path).
- **Notification coordination with Story 3.6**: The crash notification uses the notification-manager from Story 3.6. If that story is not yet implemented, a minimal inline `new Notification()` call can be used as a temporary stub.
- **Scoped logger**: `log.scope('terminal-manager')` for exit/crash events. Normal exits at `info`, crashes at `warn`.

### Terminal Session State Machine

```
┌──────────┐     PTY onExit     ┌──────────┐
│ RUNNING  │ ─────────────────→ │  EXITED  │
│          │                    │          │
│ Keys →   │                    │ Keys     │
│   PTY    │                    │ suppressed│
│          │                    │ except ↵  │
└──────────┘                    └────┬─────┘
      ↑                              │
      │          User presses        │
      │          Enter (↵)           │
      └──────────────────────────────┘
         respawn new shell process
```

### IPC Flow

```
Main Process (terminal-manager.ts)
  PTY exits → onExit({ exitCode, signal })
    → log exit event
    → webContents.send('terminal:process-exit', { exitCode, signal, isNormalExit })
    → if crash + window hidden → send notification

Renderer (TerminalView.tsx)
  onProcessExit callback fires
    → write "[Process exited with code N]" to xterm.js in dimmed text
    → set sessionState = 'exited'
    → intercept keyboard: only Enter triggers respawn

  User presses Enter
    → ipcRenderer.invoke('terminal:respawn')
    → Main process spawns new PTY
    → Data stream reconnected to xterm.js
    → sessionState = 'running'
```

### Dependencies

| Package | Version | Role in this story |
|---------|---------|-------------------|
| `node-pty` | 1.1.0-beta22 | PTY `onExit` event, new shell spawning |
| `@xterm/xterm` | 5.7.0 | Exit message rendering, keyboard interception |
| `electron` | 36.4.0 | IPC channels, Notification API (stub) |
| `electron-log` | 5.4.3 | Scoped logging for exit/crash events |
| `vitest` | 4.1.2 | Unit testing |

### Testing Standards

- **Framework**: Vitest 4.1.2
- **Co-located tests**: `src/main/terminal-manager.test.ts`, `src/renderer/components/Terminal/TerminalView.test.tsx`
- **Mocking**: Mock node-pty `onExit` callback, mock `webContents.send()`, mock xterm.js `write()` and `onKey`, mock `windowManager.isVisible()`, mock `Notification` constructor
- **Coverage targets**: All exit code branches (0 vs non-zero), keyboard interception in exited state, respawn flow, notification conditional logic (hidden vs visible)

### Project Structure Notes

Files to **create**:
```
(No new files — this story extends existing modules)
```

Files to **modify**:
```
src/
  main/
    terminal-manager.ts         # Add onExit handler, respawn logic, crash notification
    terminal-manager.test.ts    # Add exit handling and respawn tests
    ipc-handlers.ts             # Register TERMINAL_RESPAWN handler
  renderer/
    components/
      Terminal/
        TerminalView.tsx        # Add exit message rendering, Enter-to-restart, session state
        TerminalView.test.tsx   # Add exit display and keyboard interception tests
  shared/
    channels.ts                 # Add TERMINAL_PROCESS_EXIT, TERMINAL_RESPAWN constants
    ipc-types.ts                # Add TerminalProcessExitPayload type
  preload/
    index.ts                    # Add onProcessExit listener, respawnShell invoke
```

### References

- Architecture: [`architecture.md`](docs/planning-artifacts/architecture.md) — IPC dual-pattern, terminal-manager module, error handling
- PRD: [`prd.md`](docs/planning-artifacts/prd.md) — NFR17 (shell crash recovery), FR31 (shell exit display)
- Epics: [`epics.md`](docs/planning-artifacts/epics.md) — Epic 3, Story 3.4
- UX Design: [`ux-design-specification.md`](docs/planning-artifacts/ux-design-specification.md) — UX-DR27 (shell exit handling: dimmed text, Enter to restart, Ctrl+W to close tab)
- Story 1.3 (prerequisite): [`1-3-terminal-core-powershell-via-node-pty-and-xterm-js.md`](docs/implementation-artifacts/1-3-terminal-core-powershell-via-node-pty-and-xterm-js.md) — terminal-manager.ts, PTY spawning, xterm.js rendering
- Story 3.2 (prerequisite): [`3-2-wsl-shell-support.md`](docs/implementation-artifacts/3-2-wsl-shell-support.md) — Shell resolver for respawn (uses configured defaultShell)
- Story 3.6 (dependency): [`3-6-windows-notifications-and-update-checking.md`](docs/implementation-artifacts/3-6-windows-notifications-and-update-checking.md) — notification-manager for crash notifications

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Replaced auto-respawn logic in ipc-handlers.ts with user-controlled Enter-to-restart
- Exit detection fires in terminal-manager onExit → ipc-handlers sends TERMINAL_PROCESS_EXIT to renderer
- Crash notification uses Electron Notification API directly (stub for Story 3.6)
- Session state machine implemented in TerminalView via useRef (running ↔ exited)

### Completion Notes List
- All 5 ACs satisfied: dimmed exit message, crash logging, Enter-to-restart, hidden crash notification, no auto-restart
- 230 total tests passing (204 main/shared + 26 renderer), zero regressions
- Worker timeout on parallel jsdom/node runs is a resource issue, not a code defect — tests pass individually

### File List
- Modified: src/main/ipc-handlers.ts (replaced auto-respawn with exit IPC + crash notification)
- Modified: src/shared/ipc-types.ts (added onProcessExit/respawnShell to QuakeShellTerminalAPI)
- Modified: src/preload/index.ts (added onProcessExit listener and respawnShell invoke)
- Modified: src/renderer/components/Terminal/TerminalView.tsx (exit message, session state, Enter-to-restart)
- Created: src/main/ipc-handlers.test.ts (9 tests for exit handling and crash notification)
- Modified: src/renderer/components/Terminal/TerminalView.test.tsx (added 6 exit handling tests)
