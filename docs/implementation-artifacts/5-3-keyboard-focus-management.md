# Story 5.3: Keyboard Focus Management

Status: ready-for-dev

## Story

As a developer,
I want focus to move correctly between the terminal and my other applications,
so that I never lose my typing context when toggling QuakeShell.

## Acceptance Criteria

### AC 1: Focus on Hotkey Show
**Given** the terminal is hidden and the user presses the toggle hotkey
**When** the terminal slides into view
**Then** keyboard focus moves to the terminal's xterm.js instance and the cursor is blinking and ready for input

### AC 2: Focus Restore on Hotkey Hide
**Given** the terminal is visible and the user presses the toggle hotkey
**When** the terminal slides out of view
**Then** keyboard focus returns to the application window that was focused before the terminal was shown

### AC 3: Focus on Tray Icon Show
**Given** the terminal is shown via tray icon left-click
**When** the terminal becomes visible
**Then** focus moves to the terminal, same as hotkey-triggered show

### AC 4: Focus Return on Blur Hide
**Given** focus-fade is enabled and the terminal hides due to blur
**When** the terminal slides away
**Then** focus naturally returns to whatever application the user clicked on (the one that caused the blur)

### AC 5: Full Keyboard-Only Operation (NFR21)
**Given** all core terminal functionality
**When** a user operates QuakeShell without touching the mouse
**Then** all interactions work:
- Toggle (hotkey)
- Type commands
- Scroll (keyboard)
- Copy (`Ctrl+C` with selection)
- Paste (`Ctrl+V`)
- Dismiss (hotkey)
— satisfying NFR21

## Tasks / Subtasks

- [ ] Task 1: Track previously focused window before show (AC: #2)
  - [ ] 1.1 In `src/main/window-manager.ts`, before calling `win.show()` / `win.focus()`, capture the handle of the currently focused window
  - [ ] 1.2 Use Electron's `BrowserWindow.getFocusedWindow()` to check if another Electron window had focus (edge case: QuakeShell is the only Electron app)
  - [ ] 1.3 For non-Electron windows (native Windows apps): store the foreground window handle using `electron.screen` or a lightweight native module approach — or rely on OS-level focus restoration behavior
  - [ ] 1.4 Store the previous window reference in a module-scoped variable (e.g., `let previousFocusedWindowHandle: number | null`)

- [ ] Task 2: Set focus to xterm.js on terminal show (AC: #1, #3)
  - [ ] 2.1 After the slide-in animation completes, call `win.focus()` on the BrowserWindow
  - [ ] 2.2 Send an IPC message `terminal:focus` to the renderer process
  - [ ] 2.3 In `TerminalView.tsx`, listen for `terminal:focus` IPC and call `terminal.focus()` on the xterm.js instance to ensure the cursor blinks and keypresses register
  - [ ] 2.4 Add `terminal:focus` channel to `src/shared/channels.ts`
  - [ ] 2.5 Expose focus listener in `src/preload/index.ts` if needed

- [ ] Task 3: Restore focus on hotkey hide (AC: #2)
  - [ ] 3.1 After the slide-out animation completes, attempt to restore focus to the previously tracked window
  - [ ] 3.2 If the previous window was an Electron BrowserWindow, call `.focus()` on it
  - [ ] 3.3 For non-Electron windows: call `win.blur()` on the QuakeShell window — the OS typically restores focus to the previous foreground window automatically
  - [ ] 3.4 Clear the stored previous window reference after restoration

- [ ] Task 4: Handle focus-fade blur scenario (AC: #4)
  - [ ] 4.1 Verify that the existing blur handler in `window-manager.ts` (from Epic 2, Story 2.2) does NOT interfere with natural focus transfer
  - [ ] 4.2 When the terminal hides due to blur, do NOT attempt to explicitly set focus — let the OS handle it since the user clicked on another application
  - [ ] 4.3 Ensure the `previousFocusedWindowHandle` is not used/restored in the blur-triggered hide path

- [ ] Task 5: Verify keyboard-only operation flow (AC: #5)
  - [ ] 5.1 Test hotkey toggle works from any application context
  - [ ] 5.2 Verify typing in xterm.js works immediately after focus (no extra click needed)
  - [ ] 5.3 Verify keyboard scroll works (Shift+PageUp, Shift+PageDown, or terminal-specific scroll keybindings)
  - [ ] 5.4 Verify `Ctrl+C` copies selected text (when selection exists) and sends SIGINT (when no selection)
  - [ ] 5.5 Verify `Ctrl+V` pastes clipboard content into the terminal
  - [ ] 5.6 Verify toggle hotkey dismisses the terminal and returns focus

- [ ] Task 6: Write tests (AC: #1, #2, #3, #4, #5)
  - [ ] 6.1 Unit test: `window-manager.ts` stores previous focused window before show
  - [ ] 6.2 Unit test: `window-manager.ts` calls `win.focus()` after show animation
  - [ ] 6.3 Unit test: `window-manager.ts` calls `win.blur()` after hide animation
  - [ ] 6.4 Unit test: blur-triggered hide does not attempt to restore focus explicitly
  - [ ] 6.5 Integration test: renderer receives `terminal:focus` IPC and calls `terminal.focus()`
  - [ ] 6.6 Manual test script/checklist for keyboard-only operation flow (NFR21)

## Dev Notes

### Focus Management Architecture

```
Toggle Hotkey Pressed (show)
  │
  ├─ main: store currentForegroundWindow
  ├─ main: win.show() + slide animation
  ├─ main: win.focus()
  ├─ main: webContents.focus()
  └─ ipc → renderer: terminal:focus
       └─ renderer: terminal.focus()  ← xterm.js cursor blinks

Toggle Hotkey Pressed (hide)
  │
  ├─ main: slide animation → win.hide()
  ├─ main: win.blur()
  └─ OS restores focus to previousForegroundWindow

Blur Event (focus-fade)
  │
  ├─ main: slide animation → win.hide()
  └─ (no explicit focus restoration — user already clicked elsewhere)
```

### Electron Focus APIs

**Setting focus:**
- `BrowserWindow.focus()` — brings window to front and focuses it
- `webContents.focus()` — focuses the web contents within the window
- `terminal.focus()` — xterm.js API to focus the terminal element (cursor blinks)

All three must be called in sequence for reliable focus to the terminal input.

**Tracking previous window:**
- `BrowserWindow.getFocusedWindow()` — returns the focused Electron window (null if none)
- For non-Electron windows on Windows OS, the `win.blur()` approach is most reliable: when QuakeShell blurs, Windows automatically restores the previous foreground window

### Focus Timing Considerations

- Focus must be set AFTER the slide-in animation completes, not before — focusing a partially visible window can cause visual glitches
- The animation completion callback in `window-manager.ts` (from Epic 1) is the right place to trigger focus
- Add a small delay (50-100ms) after animation if focus doesn't reliably take effect immediately

### xterm.js Focus API

```typescript
// In TerminalView.tsx
const terminalRef = useRef<Terminal | null>(null);

// Listen for focus IPC
useEffect(() => {
  const cleanup = window.electronAPI.onTerminalFocus(() => {
    terminalRef.current?.focus();
  });
  return cleanup;
}, []);
```

### Copy/Paste in xterm.js

xterm.js handles `Ctrl+C` and `Ctrl+V` natively:
- `Ctrl+C` with active selection → copies to clipboard (via xterm.js)
- `Ctrl+C` without selection → sends SIGINT to the shell process
- `Ctrl+V` → pastes from clipboard into the terminal

No additional implementation needed for copy/paste — just verify it works within the focus management flow.

### Edge Cases

1. **Rapid toggle**: User presses hotkey twice quickly — ensure focus state doesn't get corrupted. The animation lock from Epic 1 should prevent this.
2. **Multiple monitors**: Focus should work correctly regardless of which monitor the terminal is on (Epic 3, Story 3.5 handles multi-monitor positioning).
3. **Onboarding overlay visible**: When the onboarding overlay is shown (Epic 4), focus should go to the overlay, not the terminal. The overlay's focus trap handles this.
4. **Terminal process crashed**: If the shell process has crashed (Epic 3, Story 3.4), focus should still move to the window — the crash recovery UI should be focusable.

### Testing Standards

- Unit tests with Vitest and mocked Electron APIs
- Mock `BrowserWindow`, `webContents`, `ipcMain` for main process tests
- Mock `window.electronAPI` for renderer process tests
- Manual testing checklist required for NFR21 keyboard-only verification (cannot be fully automated)

### Project Structure Notes

| Action | File Path | Notes |
|--------|-----------|-------|
| MODIFY | `src/main/window-manager.ts` | Add previous-window tracking, focus on show, blur on hide |
| MODIFY | `src/shared/channels.ts` | Add `terminal:focus` IPC channel |
| MODIFY | `src/preload/index.ts` | Expose `onTerminalFocus` listener via contextBridge |
| MODIFY | `src/renderer/components/Terminal/TerminalView.tsx` | Listen for `terminal:focus` IPC, call `terminal.focus()` |
| MODIFY | `src/main/window-manager.ts` (tests) | Add focus management unit tests |

### References

- **UX Design Specification**: `docs/planning-artifacts/ux-design-specification.md` — UX-DR26 (focus management requirements)
- **Architecture**: `docs/planning-artifacts/architecture.md` — IPC patterns, window-manager toggle flow
- **Epics & Stories**: `docs/planning-artifacts/epics.md` — Epic 5, Story 5.3
- **PRD**: `docs/planning-artifacts/prd.md` — NFR21 (keyboard accessible)
- **Dependencies**:
  - Epic 1 Story 1.4 (`window-manager.ts` toggle and animation logic)
  - Epic 2 Story 2.2 (focus-fade / blur handler)
  - Epic 1 Story 1.3 (`TerminalView.tsx` xterm.js instance)
  - Epic 3 Story 3.3 (tray icon left-click show)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
