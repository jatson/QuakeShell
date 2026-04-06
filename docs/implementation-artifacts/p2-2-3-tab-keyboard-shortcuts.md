# Story P2-2.3: Tab Keyboard Shortcuts

Status: ready-for-dev

## Story

As a user,
I want browser-style keyboard shortcuts to create, close, and switch tabs,
so that I can manage sessions without touching the mouse.

## Acceptance Criteria

1. **Given** the terminal is visible **When** user presses Ctrl+T **Then** a new tab is created (same as clicking +) and the new tab receives focus
2. **Given** the terminal is visible with multiple tabs **When** user presses Ctrl+W **Then** the active tab is closed and focus moves to the adjacent tab (right preferred, falls back to left)
3. **Given** exactly one tab is open **When** user presses Ctrl+W **Then** the terminal hides; the single session is NOT destroyed (same behavior as toggling the hotkey); the tab is preserved so the next toggle resumes it
4. **Given** multiple tabs **When** user presses Ctrl+Tab **Then** focus moves to the next tab (rightward, wraps to first tab when on last tab)
5. **Given** multiple tabs **When** user presses Ctrl+Shift+Tab **Then** focus moves to the previous tab (leftward, wraps to last tab when on first tab)
6. **Given** at least N tabs where 1 ≤ N ≤ 9 **When** user presses Ctrl+N (digit 1–9) **Then** focus jumps directly to the Nth tab (1-indexed); if fewer than N tabs exist, the shortcut is a no-op
7. **Given** xterm.js has keyboard focus **When** any of the above shortcuts fire **Then** the key event is intercepted by QuakeShell and NOT passed through to the running shell process
8. **Given** Ctrl+, is pressed **When** the terminal is visible **Then** the Settings overlay is opened (no-op if Settings not yet implemented — just log the intent)
9. **Given** any registered shortcut fires **When** the default browser action would occur (e.g. Ctrl+W closing a browser tab) **Then** `e.preventDefault()` is called, preventing the default

## Tasks / Subtasks

- [ ] Task 1: Create `src/renderer/hooks/useTabKeyboard.ts` — main keyboard hook (AC: #1–#9)
  - [ ] 1.1: Define the full shortcut set as a typed constant at the module top:
    ```typescript
    // All shortcuts intercepted by QuakeShell — used for xterm customKeyEventHandler too
    export const TAB_SHORTCUTS = [
      { ctrl: true, shift: false, key: 't',   action: 'new-tab'      },
      { ctrl: true, shift: false, key: 'w',   action: 'close-tab'    },
      { ctrl: true, shift: false, key: 'Tab', action: 'next-tab'     },
      { ctrl: true, shift: true,  key: 'Tab', action: 'prev-tab'     },
      { ctrl: true, shift: false, key: '1',   action: 'switch-tab-1' },
      { ctrl: true, shift: false, key: '2',   action: 'switch-tab-2' },
      { ctrl: true, shift: false, key: '3',   action: 'switch-tab-3' },
      { ctrl: true, shift: false, key: '4',   action: 'switch-tab-4' },
      { ctrl: true, shift: false, key: '5',   action: 'switch-tab-5' },
      { ctrl: true, shift: false, key: '6',   action: 'switch-tab-6' },
      { ctrl: true, shift: false, key: '7',   action: 'switch-tab-7' },
      { ctrl: true, shift: false, key: '8',   action: 'switch-tab-8' },
      { ctrl: true, shift: false, key: '9',   action: 'switch-tab-9' },
      { ctrl: true, shift: false, key: ',',   action: 'open-settings' },
    ] as const;

    export type TabAction = typeof TAB_SHORTCUTS[number]['action'];
    ```
  - [ ] 1.2: Create helper `matchShortcut(e: KeyboardEvent): TabAction | null`:
    ```typescript
    function matchShortcut(e: KeyboardEvent): TabAction | null {
      for (const s of TAB_SHORTCUTS) {
        if (
          e.ctrlKey === s.ctrl &&
          e.shiftKey === s.shift &&
          e.key === s.key
        ) {
          return s.action;
        }
      }
      return null;
    }
    ```
  - [ ] 1.3: Create `handleTabAction(action: TabAction, tabs: TabSessionDTO[], activeTabId: string | null): void`:
    ```typescript
    async function handleTabAction(action: TabAction, tabs: TabSessionDTO[], activeTabId: string | null) {
      const currentIndex = tabs.findIndex(t => t.id === activeTabId);

      switch (action) {
        case 'new-tab': {
          const newTab = await window.quakeshell.tab.create().catch(console.error);
          if (newTab) addTab(newTab);
          break;
        }
        case 'close-tab': {
          if (!activeTabId) break;
          if (tabs.length === 1) {
            await window.quakeshell.window.toggle().catch(console.error);
          } else {
            await window.quakeshell.tab.close(activeTabId).catch(console.error);
          }
          break;
        }
        case 'next-tab': {
          if (tabs.length < 2) break;
          const nextIndex = (currentIndex + 1) % tabs.length;
          await window.quakeshell.tab.switchTo(tabs[nextIndex].id).catch(console.error);
          break;
        }
        case 'prev-tab': {
          if (tabs.length < 2) break;
          const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          await window.quakeshell.tab.switchTo(tabs[prevIndex].id).catch(console.error);
          break;
        }
        case 'open-settings': {
          // Settings overlay wired in a later story — emit a custom event for now
          window.dispatchEvent(new CustomEvent('quakeshell:open-settings'));
          break;
        }
        default: {
          // switch-tab-1 through switch-tab-9
          const digit = parseInt(action.replace('switch-tab-', ''), 10);
          if (!isNaN(digit) && digit >= 1 && digit <= tabs.length) {
            await window.quakeshell.tab.switchTo(tabs[digit - 1].id).catch(console.error);
          }
          break;
        }
      }
    }
    ```
  - [ ] 1.4: Implement exported hook `useTabKeyboard()`:
    ```typescript
    export function useTabKeyboard(): void {
      useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
          const action = matchShortcut(e);
          if (!action) return;
          e.preventDefault();
          e.stopPropagation();
          handleTabAction(action, tabs.value, activeTabId.value);
        }
        // Use capture phase so we fire before xterm.js bubble-phase handlers
        document.addEventListener('keydown', onKeyDown, { capture: true });
        return () => document.removeEventListener('keydown', onKeyDown, { capture: true });
      }, []); // signals are read inside handler — no deps needed
    }
    ```
  - [ ] 1.5: Import `tabs` and `activeTabId` signals from `../../state/tab-store`, and `addTab` helper

- [ ] Task 2: Configure xterm.js `customKeyEventHandler` to suppress Tab shortcut keys (AC: #7)
  - [ ] 2.1: In `src/renderer/components/Terminal/TerminalView.tsx`, after `terminal.open(container)`, add:
    ```typescript
    terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      // Return false = xterm will NOT process this key (QuakeShell handles it)
      // Return true  = xterm processes normally
      for (const s of TAB_SHORTCUTS) {
        if (e.ctrlKey === s.ctrl && e.shiftKey === s.shift && e.key === s.key) {
          return false; // intercept — prevent xterm from eating Ctrl+W, Ctrl+T, etc.
        }
      }
      return true;
    });
    ```
  - [ ] 2.2: Import `TAB_SHORTCUTS` from `../../hooks/useTabKeyboard`
  - [ ] 2.3: Place this setup AFTER `terminal.open(container)` but BEFORE `fitAddon.fit()` in the `useEffect` setup block

- [ ] Task 3: Mount `useTabKeyboard` in `src/renderer/components/App.tsx` (AC: #1–#9)
  - [ ] 3.1: Import `useTabKeyboard` from `../hooks/useTabKeyboard`
  - [ ] 3.2: Call `useTabKeyboard()` at the top of the `App` component body (alongside existing `useEffect` hooks)
  - [ ] 3.3: No JSX changes required — the hook registers/unregisters the `keydown` listener as a side effect

- [ ] Task 4: Write unit tests in `src/renderer/hooks/useTabKeyboard.test.ts` (AC: #1–#9)
  - [ ] 4.1: Setup mocks:
    ```typescript
    vi.mock('../../state/tab-store', () => ({
      tabs: { value: [] },
      activeTabId: { value: null },
      addTab: vi.fn(),
    }));
    const mockTab = {
      create: vi.fn().mockResolvedValue({ id: 't3', shellType: 'powershell', color: '#7aa2f7', createdAt: 0 }),
      close: vi.fn().mockResolvedValue(undefined),
      switchTo: vi.fn().mockResolvedValue(undefined),
    };
    const mockWindow = { toggle: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal('quakeshell', { tab: mockTab, window: mockWindow });
    ```
  - [ ] 4.2: Helper to fire keyboard events:
    ```typescript
    function fire(key: string, ctrl = true, shift = false) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: ctrl, shiftKey: shift, bubbles: true }));
    }
    ```
  - [ ] 4.3: Render hook with `renderHook(() => useTabKeyboard())` from `@testing-library/preact`
  - [ ] 4.4: Test Ctrl+T calls `tab.create()` — assert `mockTab.create` called
  - [ ] 4.5: Test Ctrl+W with 2 tabs calls `tab.close(activeTabId)` — NOT `window.toggle()`
  - [ ] 4.6: Test Ctrl+W with 1 tab calls `window.toggle()` — NOT `tab.close()`
  - [ ] 4.7: Test Ctrl+Tab advances to next tab (wraps from last to first)
  - [ ] 4.8: Test Ctrl+Shift+Tab moves to previous tab (wraps from first to last)
  - [ ] 4.9: Test Ctrl+3 with 5 tabs calls `tab.switchTo(tabs[2].id)`
  - [ ] 4.10: Test Ctrl+9 with 3 tabs is a no-op (fewer than 9 tabs)
  - [ ] 4.11: Test that `e.preventDefault()` is called — use a spy on the event object
  - [ ] 4.12: Test hook cleanup: unmount hook, fire Ctrl+T, assert `create` NOT called again

- [ ] Task 5: Write integration test for xterm `customKeyEventHandler` (AC: #7)
  - [ ] 5.1: In `src/renderer/components/Terminal/TerminalView.test.tsx`, add a test that:
    - Renders `<TerminalView tabId="tab-1" />`
    - Verifies that `terminal.attachCustomKeyEventHandler` was called
    - Calls the handler with a `{ctrlKey: true, key: 't'}` event and asserts it returns `false`
    - Calls the handler with a `{ctrlKey: false, key: 'a'}` event and asserts it returns `true`
  - [ ] 5.2: This requires the xterm `Terminal` class to be mockable in the test environment — mock `@xterm/xterm` with `vi.mock` if not already done

## Dev Notes

### Architecture Patterns

**Capture phase listener:** The `keydown` event listener is registered on `document` with `{ capture: true }`. This ensures QuakeShell's handler fires BEFORE xterm.js's internal keydown listeners, which operate in the bubble phase. Without capture phase, xterm.js would consume `Ctrl+W` (browser close) or `Ctrl+T` (browser new tab) before QuakeShell sees them.

**xterm.js `customKeyEventHandler`:** xterm.js has its own keyboard input pipeline separate from the DOM event system. Even with a capture-phase DOM listener, xterm.js's `onData` still fires for keys it processes internally. `terminal.attachCustomKeyEventHandler(fn)` is the xterm-specific hook: if `fn` returns `false`, xterm discards the key input (does not send it to the PTY). This is essential for Ctrl+W — without it, xterm would still send ASCII control character `0x17` (ETB) to the shell.

**Signal reads inside handlers:** The `onKeyDown` handler closes over the signal objects (`tabs`, `activeTabId`) but reads `.value` at call time (not at hook mount time). This means the handler always sees the latest state without needing to be recreated on each render — a key benefit of Preact signals vs. React state.

**`useEffect` dependency array is `[]`:** The handler is registered once on mount and cleaned up on unmount. This is safe because `tabs.value` and `activeTabId.value` are read synchronously at dispatch time, not captured as closures at registration time.

**Ctrl+W single-tab hide behavior (AC: #3):** The single-tab check compares `tabs.value.length === 1`. In this case, `window.quakeshell.window.toggle()` is called to hide the window. This means the PTY session is preserved — it stays alive in main process. The terminal resumes on next toggle. This is different from `tab.close()` which kills the PTY.

**`open-settings` custom event:** The `Ctrl+,` handler dispatches `new CustomEvent('quakeshell:open-settings')` on `window`. The Settings overlay (future story) listens for this event. This avoids a circular dependency between the keyboard hook and the settings component.

**No `globalShortcut` for these shortcuts:** Electron's `globalShortcut` fires even when the terminal is hidden, which would interfere with other applications using the same keys. These shortcuts are registered in the renderer (`document.addEventListener`) so they only fire when the renderer window is focused and visible.

### Edge Cases to Handle

| Scenario | Expected Behavior |
|---|---|
| Ctrl+Tab with 1 tab | No-op (guard `tabs.length < 2`) |
| Ctrl+W while create is in-flight | Guard with `if (!activeTabId) break` |
| Ctrl+3 when activeTabId is null | `currentIndex` will be -1; switch-tab still works since it uses index directly |
| Rapid Ctrl+T spam | Each call is independent; `tab.create()` is async but creates correctly via TabManager's Map |
| Ctrl+W on the last tab then Ctrl+T | Window hides (last tab preserved), not destroyed; next toggle shows the preserved tab |

### Key Files to Create/Modify

| File | Action | Notes |
|---|---|---|
| `src/renderer/hooks/useTabKeyboard.ts` | CREATE | Keyboard hook with all shortcut logic |
| `src/renderer/hooks/useTabKeyboard.test.ts` | CREATE | Unit tests for each shortcut |
| `src/renderer/components/App.tsx` | MODIFY | Call `useTabKeyboard()` in component body |
| `src/renderer/components/Terminal/TerminalView.tsx` | MODIFY | Add `attachCustomKeyEventHandler` for xterm interception |

### Project Structure Notes

- Create `src/renderer/hooks/` directory if it does not exist.
- `useTabKeyboard.ts` is a plain TypeScript module that exports a Preact hook — no JSX, no `.tsx` extension needed.
- The `TAB_SHORTCUTS` constant is exported from `useTabKeyboard.ts` so `TerminalView.tsx` can import it for `customKeyEventHandler` without duplicating the shortcut list.
- Do NOT register these shortcuts with `ipcMain` or `globalShortcut` — renderer-only registration is intentional.
- `Ctrl+Shift+D` (split pane) is listed in the shortcuts table but NOT implemented in this story — it belongs to Story P2-3.1. Exclude it from `TAB_SHORTCUTS` in this story to avoid activating an unimplemented code path; add it in P2-3.1.

### References

- `src/renderer/state/tab-store.ts` — `tabs`, `activeTabId` signals and `addTab` helper (created in Story P2-2.2)
- `src/renderer/components/Terminal/TerminalView.tsx` — location for `attachCustomKeyEventHandler` setup
- `src/renderer/components/App.tsx` — where hook is mounted
- `docs/planning-artifacts/epics-v2.md` — UX-DR-P2-07 for complete shortcut list reference
- [xterm.js `attachCustomKeyEventHandler` docs](https://xtermjs.org/docs/api/terminal/classes/terminal/#attachcustomkeyeventhandler) — returns `true` to pass key to xterm, `false` to suppress
