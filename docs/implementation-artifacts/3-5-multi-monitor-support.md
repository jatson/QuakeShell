# Story 3.5: Multi-Monitor Support

Status: review

## Story

As a developer,
I want the terminal to appear on whichever monitor I'm currently working on,
So that I never have to look away from my active work to see the terminal.

## Acceptance Criteria

1. **Given** the user is working on a multi-monitor setup **When** the toggle hotkey is pressed **Then** `window-manager.ts` determines the active monitor by finding the display containing the currently focused window's position

2. **Given** the active monitor is identified **When** the terminal slides down **Then** it spans 100% of that monitor's width and positions at that monitor's top edge at the configured `dropHeight` percentage of that monitor's height

3. **Given** the terminal was last shown on Monitor A **When** the user moves focus to Monitor B and presses the hotkey **Then** the terminal repositions to Monitor B's top edge before the slide-down animation begins

4. **Given** the terminal is visible on a monitor **When** that monitor is disconnected **Then** the terminal repositions to the primary monitor **And** the next toggle cycle uses the primary monitor as the active display

5. **Given** a single-monitor setup **When** the toggle is triggered **Then** the terminal always appears on the primary (and only) display — no multi-monitor logic overhead

6. **Given** monitors with different resolutions or DPI scaling **When** the terminal repositions between monitors **Then** the `dropHeight` percentage is recalculated relative to the new monitor's resolution, and the terminal width matches the new monitor's full width

## Tasks / Subtasks

- [x] Task 1: Implement active monitor detection (AC: #1, #5)
  - [x] 1.1: In `src/main/window-manager.ts`, create `getActiveDisplay(): Electron.Display` function
  - [x] 1.2: Use `screen.getCursorScreenPoint()` to get the current cursor position
  - [x] 1.3: Use `screen.getDisplayNearestPoint(cursorPoint)` to find the display containing the cursor
  - [x] 1.4: Fallback: if no display found, use `screen.getPrimaryDisplay()` as the default
  - [x] 1.5: For single-monitor setups, `getDisplayNearestPoint()` naturally returns the only display — no special-casing needed

- [x] Task 2: Update toggle positioning to use active display (AC: #2, #3)
  - [x] 2.1: Refactored `show()` method to call `getActiveDisplay()` on every toggle and recalculate dimensions per-monitor
  - [x] 2.2: Calculate terminal bounds based on the active display's `workArea`
  - [x] 2.3: Before slide-down animation begins, call `BrowserWindow.setBounds()` to position the window at the target monitor's top edge
  - [x] 2.4: The slide animation starts from `y - height` (above the visible area) and animates to `y` (top edge)

- [x] Task 3: Handle monitor reposition on toggle (AC: #3)
  - [x] 3.1: Track the last display ID where the terminal was shown: `lastDisplayId: number`
  - [x] 3.2: On each show(), getActiveDisplay() provides the current display
  - [x] 3.3: Dimensions recalculated per-monitor on every show
  - [x] 3.4: Update `lastDisplayId` to the new display ID after positioning
  - [x] 3.5: If the terminal is being hidden (slide up), hide it in place on its current monitor — no repositioning on hide

- [x] Task 4: Handle monitor disconnection (AC: #4)
  - [x] 4.1: Register `screen.on('display-removed')` listener in window-manager createWindow()
  - [x] 4.2: When a display is removed, check if the terminal is currently on that display by comparing `lastDisplayId` with `oldDisplay.id`
  - [x] 4.3: If the terminal was on the removed display and is currently visible, reposition it to the primary display using `screen.getPrimaryDisplay()`
  - [x] 4.4: If the terminal was on the removed display and is currently hidden, update `lastDisplayId` to the primary display ID
  - [x] 4.5: Log the display removal event via scoped logger

- [x] Task 5: Handle DPI scaling and resolution differences (AC: #6)
  - [x] 5.1: Use `display.workArea` (not `display.bounds`) for positioning — `workArea` accounts for the taskbar and is in DPI-scaled coordinates
  - [x] 5.2: Electron's `screen` API returns coordinates in DPI-scaled logical pixels, so no manual DPI conversion is needed
  - [x] 5.3: Recalculate `dropHeight` percentage against the new display's `workArea.height` when repositioning between monitors
  - [x] 5.4: Recalculate `width` to match the new display's `workArea.width` when repositioning
  - [x] 5.5: Terminal reflow handled by existing resize event propagation

- [x] Task 6: Register display change listeners (AC: #4)
  - [x] 6.1: Register `screen.on('display-added')` to log when new monitors are connected
  - [x] 6.2: Register `screen.on('display-removed')` for monitor disconnection handling (Task 4)
  - [x] 6.3: Display-metrics-changed not needed — workArea recalculated on every show()
  - [x] 6.4: Listeners registered in createWindow() after app.whenReady()

- [x] Task 7: Unit and integration testing (AC: #1–#6)
  - [x] 7.1: Extended `src/main/window-manager.test.ts`: multi-monitor describe block with 7 new tests
  - [x] 7.2: Test monitor reposition: cursor on Display B when terminal was last on Display A, verify bounds updated
  - [x] 7.3: Test display-removed: mock `screen.on('display-removed')` event, verify terminal repositions to primary display
  - [x] 7.4: Test DPI scaling: mock display with taskbar at top (workArea.y=40), verify workArea used correctly
  - [x] 7.5: Test dropHeight recalculation: display A (1040h) at 50% → 520px, display B (1400h) at 50% → 700px

## Dev Notes

### Architecture Patterns

- **Active display detection via cursor position**: The most reliable way to determine the "active" monitor is to use the cursor position (`screen.getCursorScreenPoint()`) rather than the focused window position. The cursor is always on a specific display, even if no window is focused. `screen.getDisplayNearestPoint()` maps the cursor coordinates to a display.
- **workArea vs bounds**: `display.workArea` excludes the Windows taskbar area. `display.bounds` includes the entire screen including the taskbar. Always use `workArea` for terminal positioning to avoid overlapping the taskbar.
- **DPI-scaled coordinates**: Electron's `screen` API returns logical (DPI-scaled) coordinates. On a 4K display at 200% scaling, the logical resolution is 1920×1080. `BrowserWindow.setBounds()` also uses logical coordinates. No manual DPI conversion is needed.
- **Reposition before animation**: When the terminal needs to move to a different monitor, the window bounds are set to the new monitor's position BEFORE the slide animation begins. This prevents the terminal from visually sliding across screens.
- **Display event listeners**: `screen.on('display-removed')` handles hot-unplugging monitors. `screen.on('display-metrics-changed')` handles resolution/DPI changes (e.g., connecting a laptop to a projector). These listeners are registered once during window-manager initialization.
- **Backward compatibility**: Single-monitor users experience no change. `getDisplayNearestPoint()` returns the only display, and the positioning math works the same way.

### Display Detection Flow

```
User presses hotkey
  → window-manager.toggle()
    → getActiveDisplay()
      → screen.getCursorScreenPoint() → { x: 2560, y: 400 }
      → screen.getDisplayNearestPoint({ x: 2560, y: 400 }) → Display #2
    → compare Display #2 with lastDisplayId
      → Different? → reposition window to Display #2 bounds
    → calculate target bounds:
        x = display.workArea.x
        y = display.workArea.y
        width = display.workArea.width
        height = display.workArea.height × dropHeightPercentage
    → window.setBounds({ x, y: y - height, width, height })  # Start above screen
    → animate y from (y - height) to y                         # Slide down
    → lastDisplayId = Display #2.id
```

### Multi-Monitor Bounds Calculation

```
Monitor A (Primary): workArea = { x: 0, y: 0, width: 1920, height: 1040 }
Monitor B (Right):   workArea = { x: 1920, y: 0, width: 2560, height: 1400 }

dropHeight = 0.4 (40%)

Terminal on Monitor A: { x: 0, y: 0, width: 1920, height: 416 }
Terminal on Monitor B: { x: 1920, y: 0, width: 2560, height: 560 }
```

### Electron APIs

| API | Usage |
|-----|-------|
| `screen.getCursorScreenPoint()` | Get current cursor position |
| `screen.getDisplayNearestPoint()` | Find display containing a point |
| `screen.getPrimaryDisplay()` | Fallback display for disconnection |
| `screen.getAllDisplays()` | List all connected displays |
| `screen.on('display-removed')` | Detect monitor disconnection |
| `screen.on('display-added')` | Detect new monitor connection |
| `screen.on('display-metrics-changed')` | Detect resolution/DPI changes |
| `BrowserWindow.setBounds()` | Position window on target display |

### Dependencies

| Package | Version | Role in this story |
|---------|---------|-------------------|
| `electron` | 36.4.0 | `screen` module, `BrowserWindow.setBounds()` |
| `electron-store` | 11.0.2 | Read `dropHeight` config value |
| `@xterm/addon-fit` | 0.11.0 | Reflow terminal content after reposition |
| `electron-log` | 5.4.3 | Scoped logging for display events |
| `vitest` | 4.1.2 | Unit testing |

### Testing Standards

- **Framework**: Vitest 4.1.2
- **Co-located tests**: `src/main/window-manager.test.ts` next to source
- **Mocking**: Mock `screen.getCursorScreenPoint()`, `screen.getDisplayNearestPoint()`, `screen.getPrimaryDisplay()`, `screen.getAllDisplays()`, `screen.on()` event handlers, `BrowserWindow.setBounds()`, mock display objects with different workArea values and scaleFactor
- **Coverage targets**: Active display detection, multi-monitor repositioning, display disconnection fallback, DPI-aware bounds calculation, single-monitor passthrough

### Project Structure Notes

Files to **create**:
```
(No new files — this story extends existing modules)
```

Files to **modify**:
```
src/
  main/
    window-manager.ts           # Add getActiveDisplay(), multi-monitor positioning, display event listeners
    window-manager.test.ts      # Add multi-monitor tests, display-removed tests, DPI tests
```

### References

- Architecture: [`architecture.md`](docs/planning-artifacts/architecture.md) — Window manager module, setBounds animation, display handling
- PRD: [`prd.md`](docs/planning-artifacts/prd.md) — FR32 (multi-monitor positioning), FR33 (monitor fallback)
- Epics: [`epics.md`](docs/planning-artifacts/epics.md) — Epic 3, Story 3.5
- UX Design: [`ux-design-specification.md`](docs/planning-artifacts/ux-design-specification.md) — UX-DR17 (multi-monitor: terminal on active monitor, reposition on toggle from different monitor, fallback to primary)
- Story 1.4 (prerequisite): [`1-4-window-management-toggle-animation-and-tray-icon.md`](docs/implementation-artifacts/1-4-window-management-toggle-animation-and-tray-icon.md) — window-manager.ts, toggle animation, setBounds positioning

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Switched from `display.bounds` to `display.workArea` for all positioning (accounts for taskbar/DPI)
- show() recalculates dimensions per-monitor on every invocation — no stale cached dimensions
- `lastDisplayId` tracks which monitor the terminal was last shown on
- `display-removed` event handler repositions visible terminal to primary display
- Fixed opacity-focus-fade integration test mock to include `workArea` property

### Completion Notes List
- All 6 ACs satisfied: active monitor detection, per-monitor sizing, cross-monitor repositioning, display-removed fallback, single-monitor passthrough, DPI/resolution handling
- 211 main/shared tests + 26 renderer tests = 237 total, zero regressions
- No `display-metrics-changed` listener needed — workArea is recalculated on every show()

### File List
- Modified: src/main/window-manager.ts (workArea positioning, lastDisplayId tracking, display event listeners)
- Modified: src/main/window-manager.test.ts (7 new multi-monitor tests, workArea mock, isDestroyed mock)
- Modified: src/main/opacity-focus-fade.integration.test.ts (added workArea to screen mock)
