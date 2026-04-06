# Story P2-3.3: Close Pane

Status: ready-for-dev

---

## Story

As a user, I want to close one pane in a split, expanding the other to full width, so that I can return to single-pane focus without losing the remaining session.

---

## Acceptance Criteria

- **AC1** — Given a tab in split mode with two panes / When user presses Ctrl+W with focus in the right pane / Then the right pane session is closed, the divider disappears, and the left pane expands to full width with no visible flash.
- **AC2** — Given user presses Ctrl+W with focus in the left pane / When processed / Then the left pane session is closed and the right pane expands to full width.
- **AC3** — Given a pane is closed via Ctrl+W / When `tab:close` IPC fires / Then the PTY process for that session is killed; the remaining session is unaffected.
- **AC4** — Given only one pane remains after closing / When the terminal re-renders / Then the single pane receives the full terminal area minus tab bar; xterm.js reflows content correctly.
- **AC5** — Given a split tab where user presses Ctrl+W in the only remaining pane / When processed / Then standard tab close logic applies (hide if last tab, close if not last).

---

## Tasks / Subtasks

### Task 1: tab-store.ts — add closePane action

- [ ] **1.1** In `src/renderer/state/tab-store.ts`, add `closePane(tabId: string)`:
  ```ts
  import { TAB_CLOSE } from '../../shared/channels';

  /**
   * Close a single pane in a split.
   * - If tabId is the split (secondary) pane: remove split pair, kill that PTY.
   * - If tabId is the primary pane: remove split pair, promote split pane to primary, kill old primary PTY.
   * Returns the surviving tabId (useful for focus assignment after close).
   */
  export async function closePane(tabId: string): Promise<string | null> {
    const pairs = splitPairs.value;

    let closingTabId: string;
    let survivingTabId: string;

    if (pairs.has(tabId)) {
      // tabId is the primary — the split partner survives
      closingTabId = tabId;
      survivingTabId = pairs.get(tabId)!;
    } else {
      // Check if tabId is a split partner
      let primaryId: string | undefined;
      for (const [primary, split] of pairs) {
        if (split === tabId) { primaryId = primary; break; }
      }
      if (!primaryId) {
        // Not in a split — caller should use normal tab close logic
        return null;
      }
      closingTabId = tabId;
      survivingTabId = primaryId;
    }

    // 1. Remove the split pair from renderer state
    removeSplitPair(closingTabId);  // from Story 3.1

    // 2. Kill the PTY session for the closing tab
    await window.electronAPI.invoke(TAB_CLOSE, { tabId: closingTabId });

    // 3. Update activeTabId so the Tab component knows the primary tab
    //    (survivingTabId becomes the canonical tab for the tab bar)
    if (activeTabId.value === closingTabId) {
      activeTabId.value = survivingTabId;
    }

    // 4. Update focused pane
    focusedPaneTabId.value = survivingTabId;

    return survivingTabId;
  }
  ```
  > **Note on `TAB_CLOSE`:** This is the existing channel from Epic 2 Story 1.2. Use the same channel — the main process handler calls `tabManager.closeTab(tabId)`. No new IPC channel is needed.

  > **Note on survivingTabId active tab:** When the PRIMARY pane is closed, `survivingTabId` is the split tab's ID. At this point the tab bar still thinks the primary (`closingTabId`) is active. Update `activeTabId` to `survivingTabId` so the tab bar and App.tsx map to the correct tab going forward. Main process's `TabManager` still has `survivingTabId` as a valid session — nothing changes there.

### Task 2: Keyboard handler — update Ctrl+W logic

- [ ] **2.1** Locate the Ctrl+W handler from Story 2.3 (likely in `src/renderer/` as `useKeyboardShortcuts.ts` or similar). Update the Ctrl+W branch:
  ```ts
  if (e.ctrlKey && !e.shiftKey && e.key === 'w') {
    e.preventDefault();

    const focused = focusedPaneTabId.value ?? activeTabId.value;
    if (!focused) return;

    // Check if we are in a split
    const isInSplit = isTabSplit.value(focused);

    if (isInSplit) {
      // Close only the focused pane, not the whole tab
      const surviving = await closePane(focused);
      if (surviving) {
        // Trigger resize for surviving pane (now 100% width)
        await resizeSinglePane(surviving); // see Task 3
      }
      return;
    }

    // --- Standard single-pane close logic (existing, unchanged) ---
    const tabIds = tabs.value.map(t => t.id);
    if (tabIds.length === 1) {
      // Hide instead of close
      await window.electronAPI.invoke(WINDOW_HIDE, {});
    } else {
      await closeTab(focused); // existing action
    }
  }
  ```
  > Import `isTabSplit`, `closePane`, `focusedPaneTabId` from `tab-store`. Import `resizeSinglePane` from the util you create in Task 3.

- [ ] **2.2** Guard against the ambiguous case where `focused` equals `activeTabId` but there is a split — in a split, `activeTabId` points to the PRIMARY tab, but focus might be in the SPLIT tab. The `focusedPaneTabId` signal (from Story 3.1 Task 6) is the source of truth. Always read `focusedPaneTabId.value` first, fall back to `activeTabId.value` only if null.

### Task 3: Resize surviving pane after close

- [ ] **3.1** Create a `resizeSinglePane(tabId: string)` helper. This can live in `src/renderer/utils/terminal-resize.ts` (create if not exists) or inline in the keyboard handler file:
  ```ts
  import { TERMINAL_RESIZE } from '../shared/channels'; // verify exact name

  /**
   * After a split pane is closed, the surviving TerminalView now occupies 100% width.
   * We need to tell the PTY its new column/row count.
   * Uses a rAF to ensure the DOM has reflowed before we measure.
   */
  export function resizeSinglePane(tabId: string): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(async () => {
        const container = document.querySelector(`[data-terminal-id="${tabId}"]`);
        if (!container) { resolve(); return; }
        const { width, height } = container.getBoundingClientRect();
        await window.electronAPI.invoke(TERMINAL_RESIZE, { tabId, width, height });
        resolve();
      });
    });
  }
  ```
  > **Why `requestAnimationFrame`:** After `removeSplitPair`, Preact re-renders App.tsx which switches from `<SplitPane>` to `<TerminalView>`. The DOM reflow happens on the next animation frame. Measuring `getBoundingClientRect()` before that frame gives the old 50% width, causing the PTY to resize to half the correct columns. `rAF` defers the measurement until after layout.

- [ ] **3.2** Alternatively, if `TerminalView` uses a `ResizeObserver` internally (common with `FitAddon`), the resize may fire automatically when the container width changes. Test whether `FitAddon.fit()` is called on container resize. If it is, skip the explicit `resizeSinglePane` call. Check `src/renderer/components/Terminal/TerminalView.tsx` for `ResizeObserver` usage.

### Task 4: SplitPane.tsx — focused pane tracking

- [ ] **4.1** In `src/renderer/components/SplitPane/SplitPane.tsx`, ensure each pane container triggers `onFocusPane` on click (not just keyboard focus):
  ```tsx
  // Add onClick in addition to onFocusCapture for mouse users
  <div
    class={styles.pane}
    style={{ flexBasis: `${ratio.value * 100}%` }}
    onFocusCapture={() => onFocusPane(primaryTabId)}
    onClick={() => onFocusPane(primaryTabId)}
  >
    <TerminalView tabId={primaryTabId} isFocused={focusedPaneTabId === primaryTabId} />
  </div>
  ```
  > xterm.js canvas captures mouse clicks — `onFocusCapture` (bubbles up from the canvas focus event) ensures we detect when xterm.js gains focus via click. If xterm.js calls `terminal.focus()` internally on click and that focus event does NOT bubble, also check whether `TerminalView` exposes an `onFocus` prop you can hook into.

- [ ] **4.2** In `src/renderer/components/App.tsx`, wire `focusedPaneTabId` signal into `SplitPane`:
  ```tsx
  import { focusedPaneTabId } from '../state/tab-store';

  // Sync focusedPaneTabId with activeTabId when not in split
  useSignalEffect(() => {
    if (!splitPairs.value.has(activeTabId.value ?? '')) {
      focusedPaneTabId.value = activeTabId.value;
    }
  });

  // In JSX:
  <SplitPane
    primaryTabId={activePrimary}
    splitTabId={splitPartner}
    focusedPaneTabId={focusedPaneTabId.value ?? activePrimary}
    onFocusPane={(id) => { focusedPaneTabId.value = id; }}
    onResizePanes={handleResizePanes}
  />
  ```

### Task 5: Visual flash prevention (AC1)

- [ ] **5.1** The "no visible flash" constraint means the transition from SplitPane → TerminalView must be imperceptible. Ensure the terminal area container has no background that would flash:
  ```css
  /* In App.module.css or equivalent */
  .terminalArea {
    background: var(--bg-terminal);
    /* Ensure no transition/animation triggers on children changes */
  }
  ```

- [ ] **5.2** Do NOT use CSS `transition` on `flex-basis` during the pane close. Animation during close looks like a bug (pane width animating to 100%). The close should be instantaneous — the split disappears and the full-width pane appears in the same render frame.

- [ ] **5.3** The signal update path (remove from `splitPairs`) → Preact re-renders App.tsx → unmounts SplitPane, mounts TerminalView. This is synchronous within a single Preact render batch. xterm.js DOM is persistent (it stays mounted in TerminalView's DOM node). The only perceivable flash would come from TerminalView remounting and re-attaching to a new DOM node. If TerminalView is keyed by `tabId`, ensure the key is stable — the surviving tab's TerminalView must keep the same key between split and non-split rendering:
  ```tsx
  // In App.tsx — use same key regardless of split state
  <TerminalView key={activePrimary} tabId={activePrimary} isFocused />
  // or inside SplitPane
  <TerminalView key={primaryTabId} tabId={primaryTabId} ... />
  ```
  Matching keys ensure the DOM node is reused (not remounted) when switching between split and non-split layout, preserving xterm.js state and scrollback.

### Task 6: Tests

- [ ] **6.1** Add to `src/renderer/state/tab-store.test.ts` (or create file for closePane):
  ```ts
  describe('closePane', () => {
    const mockInvoke = vi.fn();
    beforeEach(() => {
      mockInvoke.mockResolvedValue({});
      vi.stubGlobal('window', { electronAPI: { invoke: mockInvoke } });
      splitPairs.value = new Map([['primary-1', 'split-2']]);
      activeTabId.value = 'primary-1';
      focusedPaneTabId.value = 'split-2';
    });

    it('closes split pane and survives primary', async () => {
      const surviving = await closePane('split-2');
      expect(surviving).toBe('primary-1');
      expect(splitPairs.value.size).toBe(0);
      expect(focusedPaneTabId.value).toBe('primary-1');
      expect(mockInvoke).toHaveBeenCalledWith(TAB_CLOSE, { tabId: 'split-2' });
    });

    it('closes primary pane and survives split', async () => {
      focusedPaneTabId.value = 'primary-1';
      const surviving = await closePane('primary-1');
      expect(surviving).toBe('split-2');
      expect(splitPairs.value.size).toBe(0);
      expect(activeTabId.value).toBe('split-2');
      expect(focusedPaneTabId.value).toBe('split-2');
      expect(mockInvoke).toHaveBeenCalledWith(TAB_CLOSE, { tabId: 'primary-1' });
    });

    it('returns null for non-split tab', async () => {
      const result = await closePane('non-existent-tab');
      expect(result).toBeNull();
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('does not affect surviving tab PTY', async () => {
      await closePane('split-2');
      // Ensure TAB_CLOSE was called exactly once, for split-2 only
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).not.toHaveBeenCalledWith(TAB_CLOSE, { tabId: 'primary-1' });
    });
  });
  ```

- [ ] **6.2** Add keyboard handler integration test (if keyboard handler has unit tests):
  ```ts
  it('Ctrl+W closes focused split pane instead of whole tab', async () => {
    splitPairs.value = new Map([['tab-1', 'split-2']]);
    focusedPaneTabId.value = 'split-2';
    activeTabId.value = 'tab-1';

    const event = new KeyboardEvent('keydown', { key: 'w', ctrlKey: true, bubbles: true });
    document.dispatchEvent(event);

    await vi.waitFor(() => {
      expect(splitPairs.value.size).toBe(0);
    });
    // Tab should still exist — only split closed
    expect(activeTabId.value).toBe('tab-1');
  });
  ```

---

## Dev Notes

### Architecture Patterns

**Split close vs tab close distinction:** There are three cases for Ctrl+W in a split context:

| Scenario | Action |
|---|---|
| User in SPLIT pane (secondary), tab has split | Kill split PTY; remove pair; primary survives at 100% |
| User in PRIMARY pane, tab has split | Kill primary PTY; remove pair; split tab becomes the new primary |
| User in single pane (no split) | Existing tab close logic (hide or close) |

The keyboard handler must branch on `isInSplit(focusedPaneTabId)` BEFORE falling through to normal close logic.

**Primary pane promotion:** When the primary tab is closed, `activeTabId` in the tab bar still points to `closingTabId`. After `closePane`, update `activeTabId` to `survivingTabId`. The tab bar will continue to display a single tab, but now representing the previously-split session. The tab's title and icon should come from `TabManager`'s session data keyed by `survivingTabId`. Ensure the tab bar component reads tab data by `tabId`, not index.

**Why not animate pane collapse:** The Preact component tree switches from `<SplitPane>` to `<TerminalView>` on the next render after `splitPairs` is updated. There is no interpolation opportunity in this flow without adding a `useState(isClosing)` wrapper and a CSS transition — complexity that buys marginal UX value. The instantaneous switch is acceptable and preferred here.

**xterm.js key binding conflict:** xterm.js may intercept `Ctrl+W` itself (it can be bound to "delete word backward" in some terminal emulators or shell configurations). If xterm.js's canvas has focus and handles `Ctrl+W` internally, the key event will NOT propagate to the renderer's keyboard handler. Mitigation: use `terminal.attachCustomKeyEventHandler((e) => { if (e.ctrlKey && e.key === 'w') return false; })` to suppress xterm.js's Ctrl+W handling. This likely already exists from Story 2.3's keyboard conflict handling — verify.

**`focusedPaneTabId` lifecycle:** This signal is set:
- On `SplitPane` creation → to `splitTabId` (new pane gets focus per AC3 of Story 3.1)
- On pane click/focus → to the focused pane's tabId
- On `activeTabId` change (tab switch) → reset to new primary's tabId (so non-split tabs work)
- On `closePane` → to surviving pane's tabId

Never let `focusedPaneTabId` hold a stale tabId from a closed tab.

**`requestAnimationFrame` for resize:** The DOM layout update after `removeSplitPair` → re-render happens asynchronously relative to signal mutations. Without `rAF`, `getBoundingClientRect()` returns the OLD geometry. This is a subtle timing bug that is invisible in fast machines (resize happens correctly anyway) but manifests as a mismatched column count on slower machines. Always use `rAF` before measuring post-close dimensions.

**ResizeObserver auto-fit:** If `TerminalView` already uses `ResizeObserver` + `FitAddon`, it will automatically re-fit when the container expands to 100%. In that case, the explicit `resizeSinglePane` call is redundant but harmless. It is safe to keep it — the PTY receives two resize events but the second is a no-op if dimensions match.

### Key Files to Create/Modify

| File | Action | Purpose |
|---|---|---|
| `src/renderer/state/tab-store.ts` | Update | Add `closePane(tabId)` action; add `focusedPaneTabId` signal (if not already from Story 3.1) |
| Keyboard handler (Story 2.3 location) | Update | Ctrl+W branches on `isInSplit(focusedPaneTabId)` before normal tab close |
| `src/renderer/components/SplitPane/SplitPane.tsx` | Update | Ensure `onFocusCapture` + `onClick` both set `focusedPaneTabId` |
| `src/renderer/components/App.tsx` | Update | `useSignalEffect` to sync `focusedPaneTabId` with `activeTabId` on tab switch; stable `key` props on TerminalView |
| `src/renderer/utils/terminal-resize.ts` | Create (if not exists) | `resizeSinglePane(tabId)` with `rAF` |
| `src/renderer/state/tab-store.test.ts` | Update | `closePane` tests |

### Project Structure Notes

- `TAB_CLOSE` channel: used in Epic 2. Verify the exact constant name in `src/shared/channels.ts` before writing the `invoke` call. Do NOT create a new `tab:close-pane` channel — reuse standard `tab:close`.
- `focusedPaneTabId` signal: added in Story 3.1 Task 6. If implementing stories out of order, add it here with the same export shape.
- Keyboard handler location from Story 2.3: before implementing, search `src/renderer/` for the Ctrl+W handler. Likely candidates:
  - `src/renderer/hooks/useKeyboardShortcuts.ts`
  - `src/renderer/App.tsx` (inline `useEffect` with `addEventListener`)
  - `src/renderer/keyboard.ts`
  Do NOT duplicate the handler — find the existing one and extend it.
- xterm.js `attachCustomKeyEventHandler`: check `src/renderer/components/Terminal/TerminalView.tsx` for existing custom key handlers. Ctrl+W suppression may already be there from Story 2.3.

### References

- `docs/implementation-artifacts/p2-3-1-split-pane-creation.md` — `splitPairs`, `removeSplitPair`, `focusedPaneTabId` definitions
- `docs/implementation-artifacts/p2-3-2-split-divider-drag.md` — `onResizePanes`/`terminal:resize` pattern, `data-terminal-id` attribute
- `docs/implementation-artifacts/2-3-hotkey-remapping-with-conflict-detection.md` — existing Ctrl+W handler (Story 2.3); xterm.js custom key event handler
- `src/renderer/state/tab-store.ts` — `activeTabId`, `tabs`, `closeTab` (existing Epic 2 action)
- `src/shared/channels.ts` — `TAB_CLOSE` constant name
