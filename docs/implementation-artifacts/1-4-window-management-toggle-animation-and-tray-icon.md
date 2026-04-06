# Story 1.4: Window Management — Toggle, Animation, and Tray Icon

Status: review

## Story

As a developer,
I want to press a global hotkey to slide the terminal down from the top of the screen and press it again to slide it away,
So that I have instant, always-available terminal access without window management.

## Acceptance Criteria

1. **Given** the `src/main/window-manager.ts` module **When** it creates the BrowserWindow at app startup **Then** the window is frameless (`frame: false`), always-on-top (`alwaysOnTop: true`), has no taskbar presence (`skipTaskbar: true`), and is initially hidden (positioned offscreen at `y: -height`)

2. **Given** the hidden terminal window **When** the global hotkey (default `Ctrl+Shift+Q`) is pressed **Then** `window-manager.toggle()` is called, the window slides from `y: -height` to `y: 0` using `setBounds()` animation over 200ms with easeOutCubic easing, and the terminal receives focus

3. **Given** the visible terminal window **When** the global hotkey is pressed again **Then** the window slides from `y: 0` to `y: -height` using `setBounds()` animation over 150ms with easeInCubic easing, and focus returns to the previously focused application

4. **Given** the animation runs **When** frames are rendered **Then** the slide animation maintains 60fps with no dropped frames on integrated GPUs (NFR2)

5. **Given** the terminal is toggled from hidden to visible **When** the animation completes **Then** the total time from keypress to first visible painted frame is <100ms (NFR1)

6. **Given** the toggle cycle **When** the terminal is hidden and then shown again **Then** terminal state (scrollback, running processes, working directory) is fully preserved (UX-DR29 hide ≠ close)

7. **Given** the terminal window dimensions **When** the window is shown **Then** it spans 100% of the active monitor's width at the configured `dropHeight` percentage (default 30%) of screen height, positioned at the top edge

8. **Given** the `src/main/tray-manager.ts` module **When** the app starts **Then** a system tray icon is displayed and the app has no taskbar presence

9. **Given** the `src/main/hotkey-manager.ts` module **When** it registers the global shortcut on app ready **Then** it logs success or failure via the scoped logger, and if registration fails, the tray icon remains as a fallback interaction method

10. **Given** the window state changes **When** the window becomes visible or hidden **Then** a `window:state-changed` event is sent to the renderer via IPC with the current visibility state

## Tasks / Subtasks

- [x] Task 1: Implement window-manager module (AC: #1, #7)
  - [x] 1.1: Create `src/main/window-manager.ts`
  - [x] 1.2: Create scoped logger: `log.scope('window-manager')`
  - [x] 1.3: Implement `createWindow()` method:
    - Create BrowserWindow with: `frame: false`, `alwaysOnTop: true`, `skipTaskbar: true`, `transparent: true` (for opacity), `show: false`
    - Apply all security `webPreferences` from Story 1.1 (contextIsolation, sandbox, etc.)
    - Load preload script path
  - [x] 1.4: Calculate window dimensions: 100% monitor width × `dropHeight`% of monitor height
  - [x] 1.5: Use `screen.getDisplayNearestPoint(screen.getCursorScreenPoint())` to determine active monitor
  - [x] 1.6: Position window offscreen initially at `y: -height` (hidden state)
  - [x] 1.7: Load renderer entry URL into the BrowserWindow
  - [x] 1.8: Track internal visibility state (`isVisible: boolean`)
  - [x] 1.9: Export `createWindow()`, `toggle()`, `show()`, `hide()`, `getWindow()`, `isVisible()` as named exports

- [x] Task 2: Implement slide animation (AC: #2, #3, #4, #5)
  - [x] 2.1: Implement `show()` method with slide-down animation:
    - Animate from `y: -height` to `y: monitorTop` (typically 0)
    - Duration: 200ms with easeOutCubic easing
    - Use `setBounds()` calls at ~60fps interval (requestAnimationFrame equivalent via `setInterval` at ~16ms)
    - Call `window.focus()` after animation completes
    - Call `fitAddon.fit()` equivalent via IPC after show (terminal resize)
  - [x] 2.2: Implement `hide()` method with slide-up animation:
    - Animate from `y: monitorTop` to `y: -height`
    - Duration: 150ms with easeInCubic easing
    - Use `setBounds()` calls at ~60fps interval
    - After animation completes, do NOT close or destroy the window
  - [x] 2.3: Implement easing functions:
    - `easeOutCubic(t)`: `1 - Math.pow(1 - t, 3)` — for show animation (decelerating)
    - `easeInCubic(t)`: `Math.pow(t, 3)` — for hide animation (accelerating)
  - [x] 2.4: Implement `toggle()` method: if visible call `hide()`, if hidden call `show()`
  - [x] 2.5: Guard against double-toggle (prevent animation overlap — reject toggle if animation is in progress)
  - [x] 2.6: Use `performance.now()` or `Date.now()` for precise animation timing
  - [x] 2.7: Log animation start/end and duration via scoped logger

- [x] Task 3: Ensure state preservation on hide (AC: #6)
  - [x] 3.1: Verify `hide()` does NOT call `window.close()` or `window.destroy()`
  - [x] 3.2: Verify `hide()` does NOT kill or restart the PTY process
  - [x] 3.3: Verify xterm.js terminal instance persists across hide/show cycles
  - [x] 3.4: Verify scrollback buffer is intact after show/hide cycle
  - [x] 3.5: Prevent `window.on('close')` from destroying the window during normal hide — intercept close event and call `hide()` instead

- [x] Task 4: Implement tray-manager module (AC: #8)
  - [x] 4.1: Create `src/main/tray-manager.ts`
  - [x] 4.2: Create scoped logger: `log.scope('tray-manager')`
  - [x] 4.3: Implement `createTray()` method:
    - Create `Tray` instance with `assets/tray/icon-light.ico` (or `icon-dark.ico` based on `nativeTheme.shouldUseDarkColors`)
    - Set tooltip: `'QuakeShell'`
  - [x] 4.4: Handle left-click on tray icon → call `windowManager.toggle()`
  - [x] 4.5: Create right-click context menu with:
    - `Toggle Terminal` → `windowManager.toggle()`
    - Separator
    - `Quit` → `app.quit()`
    - (Settings and Updates menu items can be stubs for later epics)
  - [x] 4.6: Handle `nativeTheme.on('updated')` to swap tray icon for light/dark theme
  - [x] 4.7: Export `createTray()` and `destroyTray()` as named exports

- [x] Task 5: Implement hotkey-manager module (AC: #9)
  - [x] 5.1: Create `src/main/hotkey-manager.ts`
  - [x] 5.2: Create scoped logger: `log.scope('hotkey-manager')`
  - [x] 5.3: Implement `registerHotkey(accelerator: string, callback: () => void)` method:
    - Use `globalShortcut.register(accelerator, callback)`
    - Log success: `"Global hotkey registered: {accelerator}"`
    - On failure: log warning, do NOT crash — tray icon serves as fallback
  - [x] 5.4: Implement `unregisterHotkey()` for cleanup
  - [x] 5.5: Implement `unregisterAll()` for app quit cleanup
  - [x] 5.6: Read hotkey accelerator from config via `configStore.get('hotkey')` (default: `Ctrl+Shift+Q`)
  - [x] 5.7: Export `registerHotkey()`, `unregisterHotkey()`, `unregisterAll()` as named exports

- [x] Task 6: Wire window state IPC events (AC: #10)
  - [x] 6.1: Add window channel constants to `src/shared/channels.ts`: `window:toggle`, `window:state-changed`
  - [x] 6.2: In `window-manager.ts` show/hide methods, after state change, emit via callback (not direct IPC)
  - [x] 6.3: In `src/main/ipc-handlers.ts`, register:
    - Window state change forwarding: when window-manager signals show/hide, call `webContents.send(CHANNELS.WINDOW_STATE_CHANGED, { visible: boolean })`
    - `ipcMain.handle(CHANNELS.WINDOW_TOGGLE, () => windowManager.toggle())`
  - [x] 6.4: Update `src/preload/index.ts` to populate `quakeshell.window` namespace:
    - `onStateChanged(callback)` → `ipcRenderer.on(CHANNELS.WINDOW_STATE_CHANGED, (_, payload) => callback(payload))`
    - `toggle()` → `ipcRenderer.invoke(CHANNELS.WINDOW_TOGGLE)`
  - [x] 6.5: Update TypeScript type declarations for `window.quakeshell.window` in `src/shared/ipc-types.ts`

- [x] Task 7: Integrate all managers in app lifecycle (AC: all)
  - [x] 7.1: Update `src/main/index.ts` app ready handler to:
    1. Initialize config-store (from Story 1.2)
    2. Create BrowserWindow via `windowManager.createWindow()`
    3. Create tray via `trayManager.createTray()`
    4. Register hotkey via `hotkeyManager.registerHotkey(config.hotkey, () => windowManager.toggle())`
    5. Register all IPC handlers
    6. Spawn terminal (from Story 1.3)
  - [x] 7.2: On `app.on('will-quit')`, call `hotkeyManager.unregisterAll()`
  - [x] 7.3: On `app.on('window-all-closed')`, prevent default quit (keep tray-resident)
  - [x] 7.4: Intercept `BrowserWindow.on('close')` to hide instead of quit (unless explicitly quitting)

- [x] Task 8: Create placeholder tray icon assets (AC: #8)
  - [x] 8.1: Create `assets/tray/icon-light.ico` — simple placeholder icon for light theme
  - [x] 8.2: Create `assets/tray/icon-dark.ico` — simple placeholder icon for dark theme
  - [x] 8.3: Create `assets/icon.ico` — app icon placeholder

- [x] Task 9: Create renderer window state store (AC: #10)
  - [x] 9.1: Create `src/renderer/state/window-store.ts` using `@preact/signals`
  - [x] 9.2: Define `isVisible` signal, initialized from IPC
  - [x] 9.3: Subscribe to `window.quakeshell.window.onStateChanged()` to update signal
  - [x] 9.4: Export signal for use in components (e.g., to trigger fitAddon.fit() on show)

- [x] Task 10: Write unit tests (AC: all)
  - [x] 10.1: Create `src/main/window-manager.test.ts`:
    - Test: window created with correct options (frameless, alwaysOnTop, skipTaskbar)
    - Test: toggle flips visibility state
    - Test: hide does not destroy window
    - Test: dimensions calculated from screen API
  - [x] 10.2: Create `src/main/hotkey-manager.test.ts`:
    - Test: registers hotkey successfully
    - Test: handles registration failure gracefully
    - Test: unregisterAll cleans up
  - [x] 10.3: Create `src/main/tray-manager.test.ts`:
    - Test: tray created with icon
    - Test: left-click triggers toggle
  - [x] 10.4: Run `npm test` and verify all tests pass

## Dev Notes

### Architecture Patterns

- **setBounds() animation**: Electron does not have a built-in animation API. The slide animation is implemented by calling `window.setBounds({ y })` repeatedly at 60fps intervals. Use `setInterval(callback, 16)` in main process (not `requestAnimationFrame` which is renderer-only). Each frame calculates the eased position based on elapsed time.
- **Hide ≠ Close (UX-DR29)**: This is the most critical architectural invariant. The BrowserWindow is NEVER destroyed during normal operation. `hide()` moves the window offscreen. The PTY process continues running. xterm.js keeps its scrollback. The `close` event on BrowserWindow must be intercepted to prevent accidental destruction.
- **Tray-resident app pattern**: `app.on('window-all-closed', (e) => e.preventDefault())` — prevents Electron from quitting when all windows are hidden. Only `app.quit()` from tray menu or explicit signal terminates the app.
- **Active monitor detection**: Use `screen.getDisplayNearestPoint(screen.getCursorScreenPoint())` to find the monitor where the user's cursor is. Terminal appears on THAT monitor. Must handle multi-monitor and monitor disconnect scenarios.
- **Animation guard**: Prevent double-toggle by tracking `isAnimating` state. If toggle is called during animation, ignore it or queue it. This prevents visual glitches from rapid hotkey presses.
- **No console.log**: Scoped loggers for each module: `window-manager`, `hotkey-manager`, `tray-manager`.

### Animation Implementation Detail

```typescript
// Easing functions
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number): number => Math.pow(t, 3);

// Show animation (200ms, easeOutCubic)
async function animateShow(win: BrowserWindow, targetY: number, height: number): Promise<void> {
  const startY = -height;
  const duration = 200;
  const startTime = performance.now();

  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const currentY = Math.round(startY + (targetY - startY) * eased);

      const bounds = win.getBounds();
      win.setBounds({ ...bounds, y: currentY });

      if (progress >= 1) {
        clearInterval(interval);
        resolve();
      }
    }, 16); // ~60fps
  });
}
```

### Window Configuration

```typescript
const win = new BrowserWindow({
  frame: false,
  alwaysOnTop: true,
  skipTaskbar: true,
  transparent: true,
  show: false,
  width: display.bounds.width,
  height: Math.round(display.bounds.height * (config.dropHeight / 100)),
  x: display.bounds.x,
  y: -Math.round(display.bounds.height * (config.dropHeight / 100)),
  webPreferences: {
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    webviewTag: false,
    devTools: !app.isPackaged,
    preload: path.join(__dirname, '../preload/index.js'),
  },
});
```

### Dependencies

| Package | Version | Role |
|---------|---------|------|
| `electron` | 41.1.0 | BrowserWindow, Tray, globalShortcut, screen, nativeTheme APIs |
| `electron-log` | 5.4.3 | Scoped logging |
| `@preact/signals` | latest | Renderer window state reactivity |

### Performance Requirements

- **NFR1**: Hotkey-to-first-painted-frame < 100ms — window is pre-created and pre-loaded, animation starts immediately on hotkey
- **NFR2**: Slide animation at 60fps — `setInterval(16ms)` with `setBounds()`, easing functions ensure smooth motion
- **NFR4/5**: No additional memory from window management — window is always alive, just repositioned
- **NFR6**: App cold start < 3s — window creation + tray + hotkey registration must be fast

### Security Considerations

- **globalShortcut**: System-wide keyboard hook. Must be unregistered on app quit to avoid lingering hooks.
- **Hotkey from config**: The hotkey accelerator string comes from config. Validate it against Electron's accelerator format before passing to `globalShortcut.register()`.
- **Tray icon path**: Use `path.join(__dirname, ...)` for icon paths — no user-controlled paths.

### UX Requirements (from ux-design-specification.md)

- **UX-DR15**: Slide-down 200ms easeOutCubic, slide-up 150ms easeInCubic, using `setBounds()` with `will-change: transform`
- **UX-DR29**: Hide ≠ close — hiding terminal never destroys sessions/tabs/scrollback
- **UX-DR4**: Terminal viewport 100% width, configurable `dropHeight` (default 30% of screen)
- **2px accent bottom edge line**: `#7aa2f7` colored line at bottom of terminal window

### Testing Standards

- **Framework**: Vitest 4.1.2
- **Co-located tests**: `window-manager.test.ts`, `hotkey-manager.test.ts`, `tray-manager.test.ts`
- **Mocking strategy**: Mock Electron APIs (`BrowserWindow`, `globalShortcut`, `Tray`, `screen`, `nativeTheme`). Test animation logic with mocked timing. Test state transitions (hidden → visible → hidden).
- **E2E**: Hotkey toggle cycle tested via Playwright in future E2E test story.

### Project Structure Notes

Files to **create**:
```
src/
  main/
    window-manager.ts            # BrowserWindow creation, show/hide animation, toggle
    window-manager.test.ts       # Unit tests
    hotkey-manager.ts            # globalShortcut register/unregister
    hotkey-manager.test.ts       # Unit tests
    tray-manager.ts              # Tray icon, context menu, theme switching
    tray-manager.test.ts         # Unit tests
  renderer/
    state/
      window-store.ts            # @preact/signals window visibility state
assets/
  icon.ico                       # App icon placeholder
  tray/
    icon-light.ico               # Tray icon for light theme
    icon-dark.ico                # Tray icon for dark theme
```

Files to **modify**:
```
src/
  main/
    index.ts                     # Wire up all managers on app ready, lifecycle events
    ipc-handlers.ts              # Add window IPC handlers (toggle, state-changed)
  shared/
    channels.ts                  # Add window channel constants
    ipc-types.ts                 # Add window.quakeshell.window type declarations
  preload/
    index.ts                     # Populate quakeshell.window namespace
```

### References

- Architecture: `docs/planning-artifacts/architecture.md` — Window manager pattern, hotkey manager, tray manager, animation implementation
- PRD: `docs/planning-artifacts/prd.md` — FR8-FR13 (window management), FR21-FR24 (system tray), FR25-FR27 (hotkey), NFR1-NFR2 (performance)
- Epics: `docs/planning-artifacts/epics.md` — Epic 1, Story 1.4
- UX Design: `docs/planning-artifacts/ux-design-specification.md` — UX-DR4, UX-DR15 (animations), UX-DR29 (hide ≠ close)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed constructor mock issue in tests: Vitest requires `function` keyword for mocked constructors (not arrow functions)
- Added `_reset()` test helper to window-manager for clean state between tests

### Completion Notes List

- Implemented window-manager with frameless, always-on-top, skip-taskbar BrowserWindow
- Slide-down animation (200ms easeOutCubic) and slide-up animation (150ms easeInCubic) using setBounds() at ~60fps
- Animation guard prevents double-toggle during animation
- Close event intercepted to hide instead of destroy (UX-DR29: hide ≠ close)
- Tray-resident app pattern: window-all-closed prevented from quitting
- Active monitor detection via screen.getDisplayNearestPoint(cursor)
- Tray manager with light/dark theme icon switching via nativeTheme
- Hotkey manager with graceful failure (tray as fallback)
- Window state IPC events forwarded to renderer via onStateChange callback
- Renderer window-store using @preact/signals for reactive visibility state
- All 74 tests passing (8 test files), no regressions

### File List

New files:
- src/main/window-manager.ts
- src/main/window-manager.test.ts
- src/main/tray-manager.ts
- src/main/tray-manager.test.ts
- src/main/hotkey-manager.ts
- src/main/hotkey-manager.test.ts
- src/renderer/state/window-store.ts
- assets/tray/icon-light.ico
- assets/tray/icon-dark.ico
- assets/icon.ico

Modified files:
- src/main/index.ts
- src/main/ipc-handlers.ts
- src/shared/ipc-types.ts
- src/preload/index.ts

### Change Log

- 2026-03-31: Implemented Story 1.4 — Window Management, Toggle Animation, Tray Icon, and Hotkey Manager
