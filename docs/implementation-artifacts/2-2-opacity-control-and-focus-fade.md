# Story 2.2: Opacity Control and Focus-Fade

Status: review

## Story

As a developer,
I want to adjust terminal opacity and enable auto-hide when I click away,
So that I can see content behind the terminal and have it disappear automatically when I'm done.

## Acceptance Criteria

1. **Given** the `opacity` setting in the config (range 0.1 to 1.0, default 0.85) **When** the terminal window is visible **Then** the window opacity matches the configured value, applied to the BrowserWindow

2. **Given** the `opacity` config value is changed via JSON **When** the hot-reload detects the change **Then** the terminal window opacity updates immediately with no restart required

3. **Given** the `focusFade` setting is `true` (default) **When** the terminal window loses focus (user clicks on another application) **Then** after a 300ms grace period, the terminal slides up and hides using the standard hide animation

4. **Given** focus-fade is active and the 300ms grace period is running **When** the terminal regains focus within 300ms (e.g., user clicked a Windows notification then returned) **Then** the hide is cancelled and the terminal remains visible

5. **Given** the `focusFade` setting is `false` **When** the terminal window loses focus **Then** the terminal remains visible — only the hotkey or tray click can hide it

6. **Given** the `focusFade` config value is changed via JSON **When** the hot-reload detects the change **Then** the new focus-fade behavior takes effect immediately — if changed from `true` to `false`, the blur listener is removed; if changed from `false` to `true`, the blur listener is added with the 300ms grace period

## Tasks / Subtasks

- [x] Task 1: Apply opacity to BrowserWindow on startup and visibility changes (AC: #1)
  - [x] 1.1: In `src/main/window-manager.ts`, read `opacity` from config-store during BrowserWindow creation and apply via `win.setOpacity(configStore.get('opacity'))`
  - [x] 1.2: Ensure opacity is re-applied after every show animation completes (in case OS or Electron resets it)
  - [x] 1.3: Validate the opacity range (clamp to 0.1–1.0) before passing to `setOpacity()` as a defensive measure
  - [x] 1.4: Write unit test in `src/main/window-manager.test.ts` — verify BrowserWindow.setOpacity called with config value on creation and after show

- [x] Task 2: Wire opacity hot-reload to BrowserWindow (AC: #2)
  - [x] 2.1: In the config-store change handler (from Story 2.1), detect `opacity` key changes
  - [x] 2.2: Call `windowManager.setOpacity(newValue)` immediately when opacity changes — no window recreation, no flicker
  - [x] 2.3: Broadcast `config:changed` event to renderer for signal update (handled by Story 2.1 infrastructure)
  - [x] 2.4: Write unit test verifying opacity change triggers `BrowserWindow.setOpacity()` with the new value

- [x] Task 3: Implement focus-fade blur handler with 300ms grace period (AC: #3, #4)
  - [x] 3.1: In `src/main/window-manager.ts`, create a `setupFocusFade()` method that registers a `blur` event listener on the BrowserWindow
  - [x] 3.2: The blur handler starts a 300ms `setTimeout` timer — store the timer reference as a module-level variable (e.g., `focusFadeTimer: NodeJS.Timeout | null`)
  - [x] 3.3: After 300ms, if the timer hasn't been cancelled, call `windowManager.hide()` which triggers the standard slide-up animation (easeInCubic, `animationSpeed × 0.75` duration)
  - [x] 3.4: Register a `focus` event listener on the BrowserWindow — when focus is regained, clear the `focusFadeTimer` via `clearTimeout()` to cancel any pending hide
  - [x] 3.5: Guard against race conditions: if hide animation is already in progress when focus returns, cancel the animation and keep the window visible
  - [x] 3.6: Write unit test: simulate blur → wait 300ms → verify hide called; simulate blur → focus within 300ms → verify hide NOT called

- [x] Task 4: Implement focus-fade disable behavior (AC: #5)
  - [x] 4.1: In `src/main/window-manager.ts`, create a `teardownFocusFade()` method that removes the blur listener and clears any pending timer
  - [x] 4.2: On startup, read `focusFade` from config-store — if `true`, call `setupFocusFade()`; if `false`, do nothing (no blur listener)
  - [x] 4.3: Write unit test: with `focusFade: false`, simulate blur → verify terminal remains visible, no hide triggered

- [x] Task 5: Wire focus-fade hot-reload for dynamic enable/disable (AC: #6)
  - [x] 5.1: In the config-store change handler, detect `focusFade` key changes
  - [x] 5.2: If changed from `true` → `false`: call `teardownFocusFade()` to remove the blur listener and clear any pending timer
  - [x] 5.3: If changed from `false` → `true`: call `setupFocusFade()` to add the blur listener with the 300ms grace period
  - [x] 5.4: If changed while a grace period timer is running (rare edge case): clear the timer first, then apply the new behavior
  - [x] 5.5: Broadcast `config:changed` event to renderer for signal update
  - [x] 5.6: Write unit test: change `focusFade` from `true` to `false` → simulate blur → verify no hide; change from `false` to `true` → simulate blur → wait 300ms → verify hide called

- [x] Task 6: Edge case handling and defensive coding (AC: #3, #4, #5)
  - [x] 6.1: Ensure focus-fade does NOT trigger when the window is being hidden by hotkey or tray click — only on external blur events
  - [x] 6.2: Ensure focus-fade does NOT trigger when the window is already in the process of hiding (animation in progress)
  - [x] 6.3: Ensure focus-fade timer is cleaned up when the window is hidden by any method (hotkey, tray, focus-fade itself)
  - [x] 6.4: Ensure focus-fade does NOT trigger during the show animation (blur events can fire during `setBounds` animation)
  - [x] 6.5: Add a `isAnimating` guard flag in window-manager to prevent focus-fade from interfering with animations
  - [x] 6.6: Write integration tests for edge cases: hotkey hide during grace period, rapid toggle during focus-fade, blur during show animation

- [x] Task 7: Integration testing (AC: #1–#6)
  - [x] 7.1: Write integration test: start app with `opacity: 0.5` → verify window opacity is 0.5 → change config to `opacity: 0.9` → verify opacity updates to 0.9
  - [x] 7.2: Write integration test: full focus-fade cycle — show terminal → click away → wait 300ms → verify hidden → toggle back → verify shown with correct opacity
  - [x] 7.3: Write integration test: focus-fade grace period cancellation — show terminal → click away → return within 200ms → verify terminal still visible

## Dev Notes

### Architecture Patterns

- **BrowserWindow opacity**: Electron's `BrowserWindow.setOpacity(value)` operates on the native Win32 window via `SetLayeredWindowAttributes`. It accepts a value from 0.0 (fully transparent) to 1.0 (fully opaque). This is a lightweight call — no window recreation needed, no flicker.
- **Focus-fade with grace period (UX-DR16)**: The 300ms delay is critical to avoid accidental hides when the user clicks a Windows notification, task switcher, or context menu. The grace period pattern: blur → start timer → if focus returns within 300ms, cancel timer → if timer expires, trigger hide animation.
- **Animation guard**: During `setBounds()` animation, Electron may fire transient `blur`/`focus` events. The `isAnimating` flag in window-manager prevents focus-fade from interfering with intentional show/hide animations.
- **Timer cleanup**: Always clear the `focusFadeTimer` when hiding by any method (hotkey, tray click, focus-fade). This prevents stale timer callbacks from firing after the window is already hidden.
- **Scoped logger**: `electron-log.scope('window-manager')` for all opacity and focus-fade logging.
- **Config-store integration**: This story depends on Story 2.1's hot-reload infrastructure. The change handler in config-store calls window-manager methods for main-process effects and broadcasts to renderer for signal updates.

### Focus-Fade State Machine

```
IDLE (window visible, focused)
  → blur event → GRACE_PERIOD (300ms timer started)
    → focus event within 300ms → IDLE (timer cleared, window stays)
    → timer expires → HIDING (hide animation starts)
      → animation completes → HIDDEN (window offscreen)
  → hotkey/tray hide → HIDING (bypass focus-fade entirely)

HIDDEN (window offscreen)
  → hotkey/tray show → SHOWING (show animation starts)
    → animation completes → IDLE
```

### Dependencies

| Package | Version | Role in this story |
|---------|---------|-------------------|
| `electron` | 41.1.0 | `BrowserWindow.setOpacity()`, blur/focus events |
| `electron-store` | 11.0.2 | Config persistence for `opacity` and `focusFade` values |
| `electron-log` | 5.4.3 | Scoped logging for opacity changes and focus-fade events |
| `vitest` | 4.1.2 | Unit and integration tests |

### Testing Standards

- **Framework**: Vitest 4.1.2
- **Co-located tests**: `src/main/window-manager.test.ts`
- **Mocking**: Mock BrowserWindow (setOpacity, on/off for blur/focus events), mock setTimeout/clearTimeout for timer tests, mock config-store for value retrieval
- **Timer testing**: Use Vitest's `vi.useFakeTimers()` for precise 300ms grace period testing
- **Coverage targets**: All opacity application paths, all focus-fade state transitions (blur→hide, blur→cancel, disabled, dynamic enable/disable), all edge cases (animation guard, cleanup)

### Project Structure Notes

Files to **create**:
```
(No new files — this story extends existing modules)
```

Files to **modify**:
```
src/
  main/
    window-manager.ts         # Add setOpacity(), setupFocusFade(), teardownFocusFade(), isAnimating guard
    window-manager.test.ts    # Add opacity and focus-fade unit tests
    config-store.ts           # Wire opacity and focusFade change handlers (extends Story 2.1 change handler)
```

### References

- Architecture: [`architecture.md`](docs/planning-artifacts/architecture.md) — window-manager module, BrowserWindow opacity, hide ≠ close pattern
- PRD: [`prd.md`](docs/planning-artifacts/prd.md) — FR11 (adjustable opacity), FR12 (focus-fade auto-hide), FR16 (configurable opacity), FR17 (configurable focus-fade)
- Epics: [`epics.md`](docs/planning-artifacts/epics.md) — Epic 2, Story 2.2
- UX Design: [`ux-design-specification.md`](docs/planning-artifacts/ux-design-specification.md) — UX-DR16 (focus-fade grace period 300ms)
- Story 1.4 (prerequisite): [`1-4-window-management-toggle-animation-and-tray-icon.md`](docs/implementation-artifacts/1-4-window-management-toggle-animation-and-tray-icon.md) — window-manager.ts, toggle/show/hide methods, setBounds animation
- Story 2.1 (dependency): [`2-1-config-hot-reload-and-live-settings.md`](docs/implementation-artifacts/2-1-config-hot-reload-and-live-settings.md) — hot-reload infrastructure, config:changed broadcast, ConfigStore sync-layer

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- All 7 tasks implemented with red-green-refactor cycle
- Opacity: clampOpacity() applied at creation, after show animation, and on setOpacity() calls
- Focus-fade: 300ms grace period with blur/focus handlers, animation guard, full teardown on hide
- Hot-reload: opacity and focusFade config changes wired through ipc-handlers to window-manager
- Edge cases: animation guard prevents focus-fade during show/hide, timer cleanup on all hide paths
- 127 tests pass across 11 test files, 0 regressions

### File List

- src/main/window-manager.ts (modified — setOpacity, clampOpacity, setupFocusFade, teardownFocusFade, clearFocusFadeTimer, animation guard)
- src/main/window-manager.test.ts (modified — opacity tests, focus-fade tests, edge case tests, integration tests)
- src/main/ipc-handlers.ts (modified — opacity and focusFade hot-reload handlers)
- src/main/ipc-handlers.test.ts (modified — hot-reload wiring tests)
