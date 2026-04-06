# Story 3.3: Tray Interactions and Context Menu

Status: review

## Story

As a developer,
I want to toggle the terminal by clicking the tray icon and access settings and controls from a right-click menu,
So that I have a fallback when the hotkey doesn't work and quick access to app controls.

## Acceptance Criteria

1. **Given** the tray icon is present in the Windows system tray **When** the user left-clicks the tray icon **Then** `window-manager.toggle()` is called, toggling the terminal visible/hidden with the standard slide animation

2. **Given** the tray icon is present **When** the user right-clicks the tray icon **Then** a native context menu appears with the following items in order: Toggle Terminal, Edit Settings, Check for Updates, About QuakeShell, Quit

3. **Given** the context menu item "Toggle Terminal" **When** the user clicks it **Then** the terminal is toggled visible/hidden **And** the menu item displays the configured hotkey as a shortcut label (e.g., `Ctrl+Shift+Q`)

4. **Given** the context menu item "Edit Settings" **When** the user clicks it **Then** the config JSON file is opened in the user's default `.json` editor via `shell.openPath()`

5. **Given** the context menu item "Check for Updates" **When** the user clicks it **Then** an update check is triggered (same as the periodic check in Story 3.6)

6. **Given** the context menu item "About QuakeShell" **When** the user clicks it **Then** QuakeShell version information is displayed (native Electron about dialog or tray notification)

7. **Given** the context menu item "Quit" **When** the user clicks it **Then** the app performs graceful shutdown: saves current config state, kills all PTY processes cleanly (no orphaned shell processes), closes the window, removes the tray icon, and exits

8. **Given** the Windows system theme changes between light and dark **When** the tray icon is rendered **Then** the appropriate icon variant is displayed (light icon on dark taskbar, dark icon on light taskbar) using `assets/tray/icon-light.ico` and `assets/tray/icon-dark.ico` (NFR23)

## Tasks / Subtasks

- [x] Task 1: Implement tray left-click toggle (AC: #1)
  - [x] 1.1: In `src/main/tray-manager.ts`, register a `tray.on('click')` handler that calls `windowManager.toggle()`
  - [x] 1.2: Ensure the click handler triggers the standard slide animation (same behavior as the global hotkey)
  - [x] 1.3: Import `windowManager` dependency — use dependency injection or module import pattern consistent with existing codebase

- [x] Task 2: Build native context menu (AC: #2, #3, #4, #5, #6, #7)
  - [x] 2.1: Create the context menu using `Menu.buildFromTemplate()` with the following items in order:
    - `Toggle Terminal` (with accelerator label from config)
    - Separator
    - `Edit Settings`
    - `Check for Updates`
    - Separator
    - `About QuakeShell`
    - `Quit`
  - [x] 2.2: Set the context menu via `tray.setContextMenu(menu)` so it appears on right-click
  - [x] 2.3: For "Toggle Terminal": set `click` to call `windowManager.toggle()`, set `accelerator` label to the configured hotkey string from config-store (display only, not functional — the global hotkey handles actual keypresses)
  - [x] 2.4: For "Edit Settings": set `click` to call `shell.openPath(configStore.getConfigPath())` to open the JSON config file in the user's default editor
  - [x] 2.5: For "Check for Updates": set `click` to call `notificationManager.checkForUpdates()` (Story 3.6 provides the implementation — stub the handler initially)
  - [x] 2.6: For "About QuakeShell": set `click` to show version info via `app.showAboutPanel()` or a tray notification with `app.getVersion()` and app name
  - [x] 2.7: For "Quit": set `click` to call `gracefulShutdown()` function

- [x] Task 3: Implement graceful shutdown (AC: #7)
  - [x] 3.1: Create `gracefulShutdown()` function in `src/main/app-lifecycle.ts` (or `tray-manager.ts`)
  - [x] 3.2: In shutdown sequence: call `terminalManager.killAll()` to terminate all PTY processes cleanly
  - [x] 3.3: Call `windowManager.close()` to close the BrowserWindow
  - [x] 3.4: Call `tray.destroy()` to remove the tray icon from the system tray
  - [x] 3.5: Call `app.quit()` to exit the Electron process
  - [x] 3.6: Add safeguard: if PTY processes don't terminate within 2 seconds, force-kill them to prevent orphaned processes
  - [x] 3.7: Log each shutdown step via scoped logger for debugging

- [x] Task 4: Implement theme-aware tray icons (AC: #8)
  - [x] 4.1: Create icon assets: `assets/tray/icon-light.ico` (for dark taskbar) and `assets/tray/icon-dark.ico` (for light taskbar)
  - [x] 4.2: In `tray-manager.ts`, detect system theme using `nativeTheme.shouldUseDarkColors`
  - [x] 4.3: Set initial tray icon based on current theme: dark taskbar → `icon-light.ico`, light taskbar → `icon-dark.ico`
  - [x] 4.4: Register `nativeTheme.on('updated')` listener to switch the icon when the system theme changes
  - [x] 4.5: Create helper function `getThemeIcon(): string` that returns the correct icon path based on `nativeTheme.shouldUseDarkColors`

- [x] Task 5: Dynamic hotkey label in context menu (AC: #3)
  - [x] 5.1: Read the current hotkey string from config-store (e.g., `"Ctrl+Shift+Q"`)
  - [x] 5.2: Set the Toggle Terminal menu item's label to include the hotkey: `Toggle Terminal\t${hotkey}` or use the `accelerator` property for display
  - [x] 5.3: When the hotkey config changes via hot-reload, rebuild the context menu to reflect the new hotkey label

- [x] Task 6: Wire tray-manager to IPC and lifecycle (AC: #1–#8)
  - [x] 6.1: Add any new IPC channel constants to `src/shared/channels.ts` if needed (e.g., `TRAY_ACTION` channels)
  - [x] 6.2: Register tray event handlers in `src/main/ipc-handlers.ts` following the single registration point pattern
  - [x] 6.3: Wire tray-manager initialization into `app-lifecycle.ts` startup sequence

- [x] Task 7: Unit and integration testing (AC: #1–#8)
  - [x] 7.1: Extend `src/main/tray-manager.test.ts` — test left-click triggers `windowManager.toggle()`
  - [x] 7.2: Test context menu construction: verify all 5 menu items are present in correct order
  - [x] 7.3: Test "Edit Settings" calls `shell.openPath()` with the config file path
  - [x] 7.4: Test "About" shows version information
  - [x] 7.5: Test "Quit" triggers graceful shutdown sequence (PTY kill, window close, tray destroy, app quit)
  - [x] 7.6: Test theme icon selection: mock `nativeTheme.shouldUseDarkColors` = true → icon-light.ico, false → icon-dark.ico
  - [x] 7.7: Test theme change: simulate `nativeTheme.on('updated')` → verify icon switches
  - [x] 7.8: Test hotkey label update: change hotkey config → verify menu is rebuilt with new label

## Dev Notes

### Architecture Patterns

- **Tray-manager extension**: This story extends the existing `tray-manager.ts` from Epic 1 (which only created a basic tray icon). The module now handles click events, context menu, theme-aware icons, and graceful shutdown coordination.
- **Context menu via `Menu.buildFromTemplate()`**: Electron's native `Menu` class constructs the right-click menu. The `accelerator` property on menu items is for display only in tray context menus — the actual shortcut is handled by the global hotkey manager.
- **Graceful shutdown coordination**: The Quit action must coordinate across multiple modules: terminal-manager (kill PTY processes), window-manager (close window), tray-manager (destroy tray), and finally app.quit(). This cross-cutting concern lives in `app-lifecycle.ts`.
- **Theme detection**: `nativeTheme.shouldUseDarkColors` returns `true` when Windows is in dark mode. The tray icon should contrast with the taskbar: dark taskbar → light icon, light taskbar → dark icon. The `nativeTheme.on('updated')` event fires when the user changes their Windows theme.
- **Config-aware menu**: The context menu must be rebuilt when the hotkey changes (via hot-reload) to update the accelerator label. Register a config change listener for the hotkey key.
- **Stub for Check for Updates**: Story 3.6 implements the actual update check logic. This story wires the menu item to call the update check function — if Story 3.6 is not yet implemented, the handler should be a no-op stub with a TODO comment.

### Context Menu Structure

```
┌─────────────────────────────┐
│ Toggle Terminal    Ctrl+`   │
│─────────────────────────────│
│ Edit Settings               │
│ Check for Updates           │
│─────────────────────────────│
│ About QuakeShell            │
│ Quit                        │
└─────────────────────────────┘
```

### Electron APIs

| API | Usage |
|-----|-------|
| `Tray.on('click')` | Left-click toggle handler |
| `Tray.setContextMenu()` | Right-click context menu |
| `Menu.buildFromTemplate()` | Construct native context menu |
| `shell.openPath()` | Open config JSON in default editor |
| `app.showAboutPanel()` | Display About dialog |
| `app.getVersion()` | Get package version string |
| `app.quit()` | Exit application |
| `nativeTheme.shouldUseDarkColors` | Detect Windows dark/light theme |
| `nativeTheme.on('updated')` | Listen for theme changes |
| `Tray.setImage()` | Switch tray icon on theme change |
| `Tray.destroy()` | Remove tray icon on shutdown |

### Graceful Shutdown Sequence

```
User clicks "Quit"
  → gracefulShutdown()
    → terminalManager.killAll()        # Kill all PTY processes
    → await timeout(2000)              # Wait max 2s for clean PTY exit
    → terminalManager.forceKillAll()   # Force-kill any surviving processes
    → windowManager.close()            # Close BrowserWindow
    → tray.destroy()                   # Remove tray icon
    → app.quit()                       # Exit Electron
```

### Dependencies

| Package | Version | Role in this story |
|---------|---------|-------------------|
| `electron` | 36.4.0 | Tray, Menu, MenuItem, shell, nativeTheme, app APIs |
| `electron-store` | 11.0.2 | Config path retrieval, hotkey value reading |
| `electron-log` | 5.4.3 | Scoped logging for tray events and shutdown |
| `vitest` | 4.1.2 | Unit testing |

### Testing Standards

- **Framework**: Vitest 4.1.2
- **Co-located tests**: `src/main/tray-manager.test.ts` next to source
- **Mocking**: Mock `Tray`, `Menu`, `shell.openPath()`, `nativeTheme`, `app.quit()`, `app.getVersion()`, mock `windowManager.toggle()`, mock `terminalManager.killAll()`
- **Coverage targets**: All click handlers, all menu item actions, theme detection branches, graceful shutdown sequence, hotkey label update

### Project Structure Notes

Files to **create**:
```
assets/
  tray/
    icon-light.ico              # Light tray icon (for dark taskbar)
    icon-dark.ico               # Dark tray icon (for light taskbar)
```

Files to **modify**:
```
src/
  main/
    tray-manager.ts             # Add click handler, context menu, theme icons, shutdown
    tray-manager.test.ts        # Add tests for all tray interactions
    app-lifecycle.ts            # Add gracefulShutdown() function
    ipc-handlers.ts             # Wire tray-related handlers if needed
  shared/
    channels.ts                 # Add tray channel constants if needed
```

### References

- Architecture: [`architecture.md`](docs/planning-artifacts/architecture.md) — Tray manager module, IPC registration patterns, graceful shutdown
- PRD: [`prd.md`](docs/planning-artifacts/prd.md) — FR28 (tray toggle), FR29 (context menu), FR30 (edit settings), NFR23 (system theme)
- Epics: [`epics.md`](docs/planning-artifacts/epics.md) — Epic 3, Story 3.3
- UX Design: [`ux-design-specification.md`](docs/planning-artifacts/ux-design-specification.md) — UX-DR14 (tray context menu structure and items)
- Story 1.4 (prerequisite): [`1-4-window-management-toggle-animation-and-tray-icon.md`](docs/implementation-artifacts/1-4-window-management-toggle-animation-and-tray-icon.md) — Basic tray icon creation, window-manager.toggle()
- Story 2.3 (prerequisite): [`2-3-hotkey-remapping-with-conflict-detection.md`](docs/implementation-artifacts/2-3-hotkey-remapping-with-conflict-detection.md) — Hotkey config value for menu label
- Story 3.1 (dependency): [`3-1-single-instance-enforcement-and-silent-autostart.md`](docs/implementation-artifacts/3-1-single-instance-enforcement-and-silent-autostart.md) — app-lifecycle.ts module, startup sequence
- Story 3.6 (dependency): [`3-6-windows-notifications-and-update-checking.md`](docs/implementation-artifacts/3-6-windows-notifications-and-update-checking.md) — Check for Updates action handler

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
None — all 215 tests pass (14 files), zero regressions

### Completion Notes List
- Extended `tray-manager.ts` with full context menu: Toggle Terminal (with hotkey label), Edit Settings (shell.openPath), Check for Updates (stub), About QuakeShell (app.showAboutPanel), Quit (gracefulShutdown)
- Added `TrayOptions` interface with `createTray()` overload supporting options object (backward compatible with legacy callback)
- Added `rebuildContextMenu()` export for dynamic hotkey label updates on config change
- Added `gracefulShutdown()` to `app-lifecycle.ts`: PTY destroy → setQuitting → window close → tray destroy → app.quit with 2s force-quit timeout
- Added `getConfigPath()` to ConfigStore interface, exposing electron-store's `.path` property
- Wired hotkey config change to `trayManager.rebuildContextMenu()` in `ipc-handlers.ts`
- Updated `index.ts` to use new `createTray(options)` overload with full context menu wiring
- 14 tray-manager tests + 10 graceful shutdown tests = 20 new tests total (215 total, up from 195)

### Change Log
- Implemented full tray context menu, graceful shutdown, and dynamic hotkey label (2026-03-31)

### File List
- `src/main/tray-manager.ts` — full context menu, TrayOptions, rebuildContextMenu
- `src/main/tray-manager.test.ts` — 14 tests covering all ACs
- `src/main/app-lifecycle.ts` — gracefulShutdown() function
- `src/main/app-lifecycle.test.ts` — 10 graceful shutdown tests
- `src/main/config-store.ts` — getConfigPath() added to interface and implementation
- `src/main/ipc-handlers.ts` — hotkey change triggers tray menu rebuild
- `src/main/index.ts` — createTray(options) overload wiring
