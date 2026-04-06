# Story 2.4: Shell Selection and Animation Speed

Status: review

## Story

As a developer,
I want to configure my default shell and animation speed via JSON,
So that I can use WSL or a custom shell path and control how fast the terminal slides.

## Acceptance Criteria

1. **Given** the `defaultShell` config value is set to `"powershell"` (default) **When** a terminal session is spawned **Then** PowerShell is launched via node-pty

2. **Given** the `defaultShell` config value is changed to `"wsl"` or a custom path (e.g., `"C:\\Git\\bin\\bash.exe"`) **When** the hot-reload detects the change **Then** the existing terminal session is NOT killed (hide ≠ close applies to config changes) **And** the next time a new session is needed (e.g., after manually closing the current session), the new shell is used

3. **Given** the `animationSpeed` config value is changed (in milliseconds, default 200) **When** the next toggle is triggered **Then** the slide-down animation uses the new value for its duration **And** the slide-up animation uses a proportionally shorter duration (configured value × 0.75, matching the 200ms/150ms default ratio)

4. **Given** the `animationSpeed` is set to `0` **When** the toggle is triggered **Then** the terminal appears/disappears instantly with no animation (respects user preference for instant mode)

## Tasks / Subtasks

- [x] Task 1: Implement shell resolution in terminal-manager (AC: #1)
  - [x] 1.1: In `src/main/terminal-manager.ts`, create a `resolveShellPath(shellConfig: string): string` helper function
  - [x] 1.2: The resolver maps known shell aliases to executable paths:
    - `"powershell"` → `"powershell.exe"` (node-pty resolves via PATH)
    - `"wsl"` → `"wsl.exe"` (node-pty resolves via PATH)
    - Any other string → treated as an absolute path to a shell executable (e.g., `"C:\\Git\\bin\\bash.exe"`)
  - [x] 1.3: When `spawn()` is called, read `defaultShell` from config-store and pass the resolved path to `node-pty.spawn()`
  - [x] 1.4: Log the spawn event with the resolved shell path via `log.scope('terminal').info('Spawning shell: ${resolvedPath}')`
  - [x] 1.5: Write co-located unit test `src/main/terminal-manager.test.ts` — test `resolveShellPath()` for `"powershell"`, `"wsl"`, and a custom absolute path

- [x] Task 2: Handle shell config hot-reload without killing sessions (AC: #2)
  - [x] 2.1: In the config-store change handler (from Story 2.1), detect `defaultShell` key changes
  - [x] 2.2: When `defaultShell` changes: do NOT kill the running PTY process — the hide ≠ close invariant extends to config changes (UX-DR29, UX-DR30)
  - [x] 2.3: Store the new shell preference in terminal-manager's internal state so that the **next** `spawn()` call uses it
  - [x] 2.4: The existing terminal session continues running its current shell until the user manually closes/exits it; only then does a new session use the updated shell
  - [x] 2.5: Broadcast `config:changed` event to renderer so the ConfigStore sync-layer updates the `defaultShell` signal
  - [x] 2.6: Log the deferred shell change via `log.scope('terminal').info('Default shell changed to ${newShell} — will apply on next session')`
  - [x] 2.7: Write unit test: change `defaultShell` from `"powershell"` to `"wsl"` → verify existing PTY NOT killed, next spawn uses `"wsl"`, config:changed broadcast sent

- [x] Task 3: Implement animation speed hot-reload with proportional hide duration (AC: #3)
  - [x] 3.1: In `src/main/window-manager.ts`, ensure the `toggle()` / `show()` / `hide()` methods read `animationSpeed` from config-store on each call (not cached at module init)
  - [x] 3.2: Show animation duration = `animationSpeed` value (default 200ms) with easeOutCubic easing
  - [x] 3.3: Hide animation duration = `animationSpeed × 0.75` (default 150ms) with easeInCubic easing
  - [x] 3.4: In the config-store change handler, detect `animationSpeed` key changes and broadcast to renderer — no main-process side effect needed since window-manager reads the value on each toggle
  - [x] 3.5: Write unit test in `src/main/window-manager.test.ts`: set `animationSpeed` to 400 → trigger toggle → verify show animation uses 400ms, hide animation uses 300ms (400 × 0.75)

- [x] Task 4: Implement instant mode when animation speed is 0 (AC: #4)
  - [x] 4.1: In `src/main/window-manager.ts`, when `animationSpeed` is `0`, skip the `setBounds()` animation loop entirely
  - [x] 4.2: For show: directly set the window to its final visible position (`y: 0`) via a single `setBounds()` call, then call `win.show()` and `win.focus()`
  - [x] 4.3: For hide: directly set the window to its hidden position (`y: -height`) via a single `setBounds()` call
  - [x] 4.4: Ensure the `window:state-changed` IPC event is still sent even in instant mode
  - [x] 4.5: Ensure the focus-fade animation guard (`isAnimating` flag from Story 2.2) is NOT set during instant mode — there's no animation to guard
  - [x] 4.6: Write unit test: set `animationSpeed` to 0 → trigger show → verify window jumps to final position instantly (no animation frames), state-changed event still sent

- [x] Task 5: Validate animation speed boundaries (AC: #3, #4)
  - [x] 5.1: The Zod schema in `src/shared/config-schema.ts` defines `animationSpeed: z.number().min(0).max(1000).default(200)` — note the minimum is 0 (not 50 as in Story 1.2's initial schema)
  - [x] 5.2: Update the Zod schema if necessary to allow `0` as a valid `animationSpeed` value (instant mode requirement)
  - [x] 5.3: In window-manager, add a defensive clamp: if `animationSpeed < 0`, treat as `0`; if `animationSpeed > 1000`, clamp to `1000`
  - [x] 5.4: Write unit test for boundary values: `0` (instant), `1` (near-instant), `1000` (maximum), negative value (clamped to 0)

- [x] Task 6: Integration testing (AC: #1–#4)
  - [x] 6.1: Write integration test: start with `defaultShell: "powershell"` → spawn terminal → change to `"wsl"` → verify existing session alive → exit shell → spawn new → verify WSL used
  - [x] 6.2: Write integration test: animation speed change cycle — toggle with default (200ms) → change to 500ms → toggle → verify slower animation → change to 0 → toggle → verify instant
  - [x] 6.3: Write integration test: custom shell path — set `defaultShell` to `"C:\\Windows\\System32\\cmd.exe"` → spawn → verify cmd.exe launched via node-pty

## Dev Notes

### Architecture Patterns

- **Shell resolution**: terminal-manager maps user-friendly aliases (`"powershell"`, `"wsl"`) to executable names and passes raw custom paths through unchanged. node-pty handles PATH resolution for executables. Custom paths must be absolute.
- **Hide ≠ close for config changes (UX-DR29, UX-DR30)**: When `defaultShell` changes via hot-reload, the running PTY process is NOT killed. The user's current session continues uninterrupted. Only when a new session is needed (after the user exits or closes the current shell) does the new shell take effect. This is consistent with the core architectural invariant.
- **Animation speed reads per-toggle**: window-manager reads `animationSpeed` from config-store on every `toggle()` call, not at module initialization. This ensures hot-reload changes take effect on the next toggle without any additional wiring.
- **Proportional duration ratio**: The 0.75 ratio for hide duration is a UX design decision (UX-DR15): show animation needs to feel responsive (easeOutCubic), while hide should be even snappier. The ratio is hardcoded, not configurable.
- **Instant mode (animationSpeed: 0)**: When set to 0, the animation loop is bypassed entirely. A single `setBounds()` call positions the window at its final position. This respects users who prefer no animation and also benefits `prefers-reduced-motion` compliance (Story 5.4).
- **Zod schema update**: The original schema in Story 1.2 set `animationSpeed: z.number().min(50).max(1000).default(200)`. This story requires updating `min(50)` to `min(0)` to support instant mode. This is a safe change — existing configs with values ≥ 50 are unaffected.

### Shell Spawning Flow

```
User changes defaultShell to "wsl"
  → electron-store detects change
  → config-store change handler: defaultShell changed
  → terminal-manager.setDefaultShell("wsl")  ← stores preference only
  → Existing PowerShell PTY continues running
  → Log: "Default shell changed to wsl — will apply on next session"

Later: user types "exit" in terminal
  → PTY process exits (code 0)
  → Terminal shows "[Process exited with code 0]"  (Story 3.4)
  → User presses Enter to restart
  → terminal-manager.spawn()
    → resolveShellPath("wsl") → "wsl.exe"
    → node-pty.spawn("wsl.exe", ...)
    → WSL shell starts
```

### Animation Speed Flow

```
User changes animationSpeed to 400
  → electron-store detects change
  → config-store broadcasts config:changed
  → No main-process side effect (window-manager reads on next toggle)

User presses Ctrl+Shift+Q (show)
  → window-manager.toggle() → show()
  → configStore.get('animationSpeed') → 400
  → Show animation: 400ms, easeOutCubic
  
User presses Ctrl+Shift+Q (hide)
  → window-manager.toggle() → hide()
  → configStore.get('animationSpeed') → 400
  → Hide animation: 400 × 0.75 = 300ms, easeInCubic

animationSpeed set to 0:
  → Show: single setBounds(finalPosition), no animation loop
  → Hide: single setBounds(hiddenPosition), no animation loop
```

### Dependencies

| Package | Version | Role in this story |
|---------|---------|-------------------|
| `electron` | 41.1.0 | `BrowserWindow.setBounds()` for animation, show/focus APIs |
| `node-pty` | 1.1.0 | Shell spawning via `spawn(shell, args, options)` |
| `electron-store` | 11.0.2 | Hot-reload detection for `defaultShell` and `animationSpeed` |
| `zod` | 4.3.6 | Schema validation — update `animationSpeed` min to 0 |
| `electron-log` | 5.4.3 | Scoped logging for shell spawn and animation events |
| `vitest` | 4.1.2 | Unit and integration tests |

### Testing Standards

- **Framework**: Vitest 4.1.2
- **Co-located tests**: `src/main/terminal-manager.test.ts`, `src/main/window-manager.test.ts`
- **Mocking**: Mock node-pty (spawn, on, write, resize, kill), mock BrowserWindow (setBounds, show, focus), mock config-store for shell/animation values
- **Timer testing**: Use Vitest's `vi.useFakeTimers()` for animation timing verification
- **Coverage targets**: All shell resolution paths (powershell, wsl, custom path), hot-reload non-kill behavior, animation speed application (show/hide proportional), instant mode, boundary values

### Project Structure Notes

Files to **create**:
```
(No new files — this story extends existing modules)
```

Files to **modify**:
```
src/
  main/
    terminal-manager.ts       # Add resolveShellPath(), setDefaultShell(), read defaultShell from config
    terminal-manager.test.ts  # Add shell resolution and hot-reload tests
    window-manager.ts         # Read animationSpeed per-toggle, implement instant mode (0ms)
    window-manager.test.ts    # Add animation speed and instant mode tests
    config-store.ts           # Wire defaultShell and animationSpeed change handlers
  shared/
    config-schema.ts          # Update animationSpeed min from 50 to 0 for instant mode
```

### References

- Architecture: [`architecture.md`](docs/planning-artifacts/architecture.md) — terminal-manager module (shell spawning), window-manager module (animation), hide ≠ close invariant
- PRD: [`prd.md`](docs/planning-artifacts/prd.md) — FR15 (configurable default shell), FR18 (configurable animation speed), NFR22 (live settings except shell change)
- Epics: [`epics.md`](docs/planning-artifacts/epics.md) — Epic 2, Story 2.4
- UX Design: [`ux-design-specification.md`](docs/planning-artifacts/ux-design-specification.md) — UX-DR15 (show 200ms easeOutCubic, hide 150ms easeInCubic — hide = show × 0.75), UX-DR29 (hide ≠ close), UX-DR30 (shell change affects new tabs only)
- Story 1.2 (prerequisite): [`1-2-configuration-system-with-schema-validation.md`](docs/implementation-artifacts/1-2-configuration-system-with-schema-validation.md) — Zod schema with animationSpeed and defaultShell fields
- Story 1.3 (prerequisite): [`1-3-terminal-core-powershell-via-node-pty-and-xterm-js.md`](docs/implementation-artifacts/1-3-terminal-core-powershell-via-node-pty-and-xterm-js.md) — terminal-manager.ts, node-pty spawn, PowerShell default
- Story 1.4 (prerequisite): [`1-4-window-management-toggle-animation-and-tray-icon.md`](docs/implementation-artifacts/1-4-window-management-toggle-animation-and-tray-icon.md) — window-manager.ts, toggle/show/hide animation, setBounds pattern
- Story 2.1 (dependency): [`2-1-config-hot-reload-and-live-settings.md`](docs/implementation-artifacts/2-1-config-hot-reload-and-live-settings.md) — hot-reload infrastructure, config-store change handler, config:changed broadcast

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Fixed bug where `animateShow()` and `animateHide()` read `animationSpeed` directly from config store instead of using the clamped value from `show()`/`hide()`. Refactored to accept `duration` as a parameter.
- Updated Zod schema `animationSpeed` min from 50 to 0 to support instant mode.
- Added `clampAnimationSpeed()` defensive helper in window-manager for values outside 0–1000 range.
- Updated config-schema test to validate `animationSpeed: -1` rejection (was testing `10` which is now valid with min=0).

### File List

- `src/main/terminal-manager.ts` — Added `resolveShellPath()`, `setDefaultShell()`, `getDefaultShell()`, `_reset()`, custom path support in `spawn()`
- `src/main/terminal-manager.test.ts` — Added tests for shell resolution, custom paths, setDefaultShell/getDefaultShell
- `src/main/window-manager.ts` — Instant mode (animationSpeed=0), `clampAnimationSpeed()`, refactored `animateShow`/`animateHide` to accept duration param
- `src/main/window-manager.test.ts` — Added instant mode tests, boundary value tests, animation speed clamping tests
- `src/main/ipc-handlers.ts` — Added `defaultShell` hot-reload handler with deferred shell change
- `src/main/index.ts` — Initialize `terminalManager.setDefaultShell()` from config on startup
- `src/shared/config-schema.ts` — Updated `animationSpeed` min(50) → min(0)
- `src/shared/config-schema.test.ts` — Updated boundary test for min(0)
- `src/main/shell-animation.integration.test.ts` — New integration tests for shell selection lifecycle and animation speed validation
