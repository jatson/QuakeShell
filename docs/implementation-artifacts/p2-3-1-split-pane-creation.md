# Story P2-3.1: Split Pane Creation

Status: dev-complete

---

## Story

As a user, I want to split the active terminal pane into two independent sessions with Ctrl+Shift+D, so that I can monitor two terminal contexts simultaneously within the same tab.

---

## Acceptance Criteria

- **AC1** — Given a tab with a single active pane / When user presses Ctrl+Shift+D / Then a `tab:create-split` IPC call creates a second `TabSession`; the renderer splits the terminal area into two equal-width panes separated by a 2px divider.
- **AC2** — Given a tab already in split mode / When user presses Ctrl+Shift+D again / Then nothing happens (max 2 panes enforced); no error is shown.
- **AC3** — Given a split is created / When the new pane spawns / Then it uses the default shell, opens in the same cwd as the primary pane, and receives input focus.
- **AC4** — Given a split tab / When the tab is hidden and then shown again / Then both pane sessions are still alive with scrollback intact (hide ≠ close applies to each pane).
- **AC5** — Given main process `TabManager` / When a split is created / Then both sessions appear as independent `TabSession` entries in the Map; the main process has no "split" concept — only the renderer tracks the split pair.

---

## Tasks / Subtasks

### Task 1: IPC channel + types

- [ ] **1.1** In `src/shared/channels.ts`, confirm (or add) the `tab:create-split` channel constant:
  ```ts
  export const TAB_CREATE_SPLIT = 'tab:create-split' as const;
  ```
  Add to the `CHANNELS` object if that pattern is used.

- [ ] **1.2** In `src/shared/ipc-types.ts`, add invoke payload/response types:
  ```ts
  export interface TabCreateSplitPayload {
    primaryTabId: string;
    cwd?: string; // passed from renderer to replicate cwd
  }

  export interface TabCreateSplitResponse {
    splitTabId: string;
  }
  ```

### Task 2: Main process IPC handler

- [ ] **2.1** In `src/main/ipc-handlers.ts`, register a `handle` for `tab:create-split`:
  ```ts
  import { TAB_CREATE_SPLIT } from '../shared/channels';
  import type { TabCreateSplitPayload, TabCreateSplitResponse } from '../shared/ipc-types';

  ipcMain.handle(TAB_CREATE_SPLIT, async (_event, payload: TabCreateSplitPayload): Promise<TabCreateSplitResponse> => {
    const log = logger.scope('ipc:tab:create-split');
    log.info('Creating split tab for primary', payload.primaryTabId);
    const splitTabId = await tabManager.createTab({ cwd: payload.cwd });
    log.info('Created split tab', splitTabId);
    return { splitTabId };
  });
  ```
  - `tabManager.createTab()` already exists from Epic 2. Pass `cwd` so the new PTY inherits working directory.
  - Main process does NOT store the split relationship — it just creates a normal `TabSession`.

- [ ] **2.2** Ensure the handler is registered inside the same `registerIpcHandlers(tabManager)` call site used by other handlers.

### Task 3: Renderer state — tab-store.ts

- [ ] **3.1** In `src/renderer/state/tab-store.ts`, add the `splitPairs` signal and `createSplit` action:
  ```ts
  import { signal, computed } from '@preact/signals';
  import { TAB_CREATE_SPLIT } from '../../shared/channels';
  import type { TabCreateSplitPayload, TabCreateSplitResponse } from '../../shared/ipc-types';

  // Existing signals...
  export const activeTabId = signal<string | null>(null);

  // NEW: maps primaryTabId → splitTabId
  export const splitPairs = signal<Map<string, string>>(new Map());

  // Derived: is the given tabId participating in any split?
  export const isTabSplit = computed(() => {
    const pairs = splitPairs.value;
    return (tabId: string) =>
      pairs.has(tabId) || [...pairs.values()].includes(tabId);
  });

  // NEW: get the split partner for a given tabId (if any)
  export function getSplitPartner(tabId: string): string | undefined {
    const pairs = splitPairs.value;
    if (pairs.has(tabId)) return pairs.get(tabId);
    for (const [primary, split] of pairs) {
      if (split === tabId) return primary;
    }
    return undefined;
  }

  export async function createSplit(primaryTabId: string, cwd?: string): Promise<string | null> {
    // Guard: already split
    if (splitPairs.value.has(primaryTabId)) return null;

    const response = await window.electronAPI.invoke<TabCreateSplitPayload, TabCreateSplitResponse>(
      TAB_CREATE_SPLIT,
      { primaryTabId, cwd }
    );

    const next = new Map(splitPairs.value);
    next.set(primaryTabId, response.splitTabId);
    splitPairs.value = next;

    return response.splitTabId;
  }
  ```
  > **Note:** `window.electronAPI.invoke` is the preload-exposed wrapper. Verify the exact preload API shape in `src/preload/` and adjust the call accordingly (may be `window.api.invoke(channel, payload)` or similar).

- [ ] **3.2** Add a `removeSplitPair(tabId: string)` helper (needed by Story P2-3.3):
  ```ts
  export function removeSplitPair(tabId: string): void {
    const next = new Map(splitPairs.value);
    // Remove regardless of whether tabId is primary or split key
    if (next.has(tabId)) {
      next.delete(tabId);
    } else {
      for (const [primary, split] of next) {
        if (split === tabId) { next.delete(primary); break; }
      }
    }
    splitPairs.value = next;
  }
  ```

### Task 4: SplitPane component

- [ ] **4.1** Create `src/renderer/components/SplitPane/SplitPane.tsx`:
  ```tsx
  import { h } from 'preact';
  import { useSignal } from '@preact/signals';
  import TerminalView from '../Terminal/TerminalView';
  import SplitDivider from './SplitDivider';
  import styles from './SplitPane.module.css';

  interface SplitPaneProps {
    primaryTabId: string;
    splitTabId: string;
    onFocusPane: (tabId: string) => void;
    focusedPaneTabId: string;
  }

  export default function SplitPane({
    primaryTabId,
    splitTabId,
    onFocusPane,
    focusedPaneTabId,
  }: SplitPaneProps) {
    // ratio: fraction of width for the LEFT (primary) pane, 0.2–0.8
    const ratio = useSignal(0.5);

    return (
      <div class={styles.container}>
        <div
          class={styles.pane}
          style={{ flexBasis: `${ratio.value * 100}%` }}
          onFocusCapture={() => onFocusPane(primaryTabId)}
        >
          <TerminalView tabId={primaryTabId} isFocused={focusedPaneTabId === primaryTabId} />
        </div>
        <SplitDivider ratio={ratio} containerRef={/* passed down */null} />
        <div
          class={styles.pane}
          style={{ flexBasis: `${(1 - ratio.value) * 100}%` }}
          onFocusCapture={() => onFocusPane(splitTabId)}
        >
          <TerminalView tabId={splitTabId} isFocused={focusedPaneTabId === splitTabId} />
        </div>
      </div>
    );
  }
  ```
  > `SplitDivider` is implemented in Story P2-3.2. For this story, render a static placeholder divider (`<div class={styles.divider} />`) in `SplitPane.module.css` that is replaced in 3.2.

  Static placeholder divider for Story 3.1 milestone (replace in 3.2):
  ```tsx
  {/* Placeholder — replaced by SplitDivider in P2-3.2 */}
  <div class={styles.divider} aria-hidden="true" />
  ```

- [ ] **4.2** Create `src/renderer/components/SplitPane/SplitPane.module.css`:
  ```css
  .container {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .pane {
    flex-shrink: 0;
    flex-grow: 0;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    /* flex-basis set inline via ratio signal */
  }

  /* Static placeholder divider — replaced in P2-3.2 with SplitDivider */
  .divider {
    width: 2px;
    flex-shrink: 0;
    background: var(--border);
    height: 100%;
  }
  ```

- [ ] **4.3** Create `src/renderer/components/SplitPane/index.ts` barrel:
  ```ts
  export { default } from './SplitPane';
  ```

### Task 5: Keyboard handler wiring

- [ ] **5.1** Locate the keyboard interceptor from Story 2.3 (check `src/renderer/` for a `useKeyboardShortcuts` hook or `keyboard.ts` handler).

- [ ] **5.2** Add the `Ctrl+Shift+D` binding:
  ```ts
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    e.preventDefault();
    const currentTabId = activeTabId.value;
    if (!currentTabId) return;
    // Guard: already split
    if (splitPairs.value.has(currentTabId)) return;
    const cwd = await getCwdForTab(currentTabId); // see note below
    const splitTabId = await createSplit(currentTabId, cwd);
    if (splitTabId) {
      focusedPaneTabId.value = splitTabId; // new pane gets focus (AC3)
    }
  }
  ```
  > **getCwdForTab**: If a `tab:get-cwd` IPC exists (check `channels.ts`), use it. If not, pass `cwd: undefined` — TabManager will default to the user's home directory or process cwd. Capturing exact cwd requires PTY interrogation; treat as best-effort for this story.

### Task 6: App.tsx integration

- [ ] **6.1** In `src/renderer/components/App.tsx`, import `splitPairs` and `SplitPane`. Change the terminal rendering block to:
  ```tsx
  import { splitPairs } from '../state/tab-store';
  import SplitPane from './SplitPane';
  import TerminalView from './Terminal/TerminalView';

  // Inside component render:
  const activePrimary = activeTabId.value;
  const splitPartner = activePrimary ? splitPairs.value.get(activePrimary) : undefined;

  return (
    <div class={styles.app}>
      <TabBar />
      <div class={styles.terminalArea}>
        {activePrimary && splitPartner ? (
          <SplitPane
            primaryTabId={activePrimary}
            splitTabId={splitPartner}
            focusedPaneTabId={focusedPaneTabId.value}
            onFocusPane={(id) => { focusedPaneTabId.value = id; }}
          />
        ) : activePrimary ? (
          <TerminalView tabId={activePrimary} isFocused />
        ) : null}
      </div>
    </div>
  );
  ```
  > `focusedPaneTabId` should be a signal in `tab-store.ts` (see Task 3 and Story P2-3.3).

- [ ] **6.2** Add `focusedPaneTabId` signal to `tab-store.ts`:
  ```ts
  export const focusedPaneTabId = signal<string | null>(null);
  ```
  Set it to `activeTabId.value` whenever `activeTabId` changes (use a `computed` or `effect`).

### Task 7: Tab bar split indicator

- [ ] **7.1** In `src/renderer/components/TabBar/TabBar.tsx` (or `Tab.tsx`), show a split indicator glyph when the tab is in split mode:
  ```tsx
  import { splitPairs } from '../../state/tab-store';

  // Inside tab render:
  const isSplit = splitPairs.value.has(tab.id);

  <span class={styles.tabLabel}>
    {tab.title}
    {isSplit && <span class={styles.splitIndicator} title="Split">⬜⬜</span>}
  </span>
  ```
  ```css
  /* TabBar.module.css */
  .splitIndicator {
    margin-left: 6px;
    font-size: 10px;
    opacity: 0.6;
    letter-spacing: -2px;
  }
  ```

### Task 8: Tests

- [ ] **8.1** Create `src/renderer/components/SplitPane/SplitPane.test.tsx`:
  ```tsx
  import { render } from '@testing-library/preact';
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import SplitPane from './SplitPane';

  // Mock TerminalView to avoid xterm.js canvas dep
  vi.mock('../Terminal/TerminalView', () => ({
    default: ({ tabId }: { tabId: string }) => <div data-testid={`terminal-${tabId}`} />,
  }));

  describe('SplitPane', () => {
    it('renders two TerminalView instances', () => {
      const { getByTestId } = render(
        <SplitPane
          primaryTabId="tab-1"
          splitTabId="tab-2"
          focusedPaneTabId="tab-2"
          onFocusPane={vi.fn()}
        />
      );
      expect(getByTestId('terminal-tab-1')).toBeTruthy();
      expect(getByTestId('terminal-tab-2')).toBeTruthy();
    });

    it('renders static divider placeholder', () => {
      const { container } = render(
        <SplitPane
          primaryTabId="tab-1"
          splitTabId="tab-2"
          focusedPaneTabId="tab-1"
          onFocusPane={vi.fn()}
        />
      );
      // divider should exist between the two panes
      expect(container.querySelectorAll('[class*="pane"]').length).toBe(2);
    });
  });
  ```

- [ ] **8.2** Create `src/renderer/state/tab-store.test.ts` additions (add to existing test file if present, or create new):
  ```ts
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { splitPairs, createSplit, removeSplitPair, getSplitPartner } from './tab-store';

  // Mock window.electronAPI
  const mockInvoke = vi.fn();
  vi.stubGlobal('window', { electronAPI: { invoke: mockInvoke } });

  beforeEach(() => {
    splitPairs.value = new Map();
    mockInvoke.mockReset();
  });

  describe('createSplit', () => {
    it('adds split pair to map on success', async () => {
      mockInvoke.mockResolvedValue({ splitTabId: 'split-99' });
      const result = await createSplit('tab-1');
      expect(result).toBe('split-99');
      expect(splitPairs.value.get('tab-1')).toBe('split-99');
    });

    it('returns null and does not invoke if already split', async () => {
      splitPairs.value = new Map([['tab-1', 'split-99']]);
      const result = await createSplit('tab-1');
      expect(result).toBeNull();
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe('removeSplitPair', () => {
    it('removes by primary tabId', () => {
      splitPairs.value = new Map([['tab-1', 'split-2']]);
      removeSplitPair('tab-1');
      expect(splitPairs.value.size).toBe(0);
    });

    it('removes by split tabId', () => {
      splitPairs.value = new Map([['tab-1', 'split-2']]);
      removeSplitPair('split-2');
      expect(splitPairs.value.size).toBe(0);
    });
  });

  describe('getSplitPartner', () => {
    it('returns split id when given primary id', () => {
      splitPairs.value = new Map([['tab-1', 'split-2']]);
      expect(getSplitPartner('tab-1')).toBe('split-2');
    });

    it('returns primary id when given split id', () => {
      splitPairs.value = new Map([['tab-1', 'split-2']]);
      expect(getSplitPartner('split-2')).toBe('tab-1');
    });

    it('returns undefined for non-split tab', () => {
      expect(getSplitPartner('tab-99')).toBeUndefined();
    });
  });
  ```

---

## Dev Notes

### Architecture Patterns

**Renderer-owns-split invariant:** The main process only sees two independent `TabSession` entries in its `Map<string, TabSession>`. It does NOT know they are paired. The split relationship (`splitPairs`) lives entirely in the renderer's `tab-store.ts` signals. This means:
- Restart / reload: split state is lost (by design, same as non-persisted split ratio)
- IPC calls during split: `tab:create-split` does nothing different from `tab:create` on the main side; it just creates a new PTY session and returns its ID
- Never pass split metadata over IPC — keep it out of `channels.ts` meanings

**Signal mutation pattern:** `splitPairs` is a `signal<Map<string, string>>`. Because signals use reference equality, you MUST create a `new Map(...)` copy before setting `.value`. Never mutate the Map in place:
```ts
// CORRECT
const next = new Map(splitPairs.value);
next.set(key, val);
splitPairs.value = next;

// WRONG — signal will NOT re-render
splitPairs.value.set(key, val); // ← mutates in place, no notification
```

**Preload API shape:** Before writing the `invoke` call in tab-store, check `src/preload/index.ts` (or similar) for the exact shape. It is likely one of:
```ts
window.electronAPI.invoke(channel, payload)
// or
window.api.send / window.api.on pattern (one-way)
```
Use `ipcRenderer.invoke` path (two-way, returns Promise). If the preload only exposes a `send/on` bridge, you will need to add `invoke` support to the preload.

**TerminalView integration:** `TerminalView` (from Epic 1) expects a `tabId` and likely calls into xterm.js. When rendered inside `SplitPane`, it receives a container element that is ~50% of the total window width. The xterm.js `fit()` call (via `FitAddon`) should handle column recalculation automatically when the container size changes, but only if `TerminalView` listens for `ResizeObserver` on its container. Confirm `TerminalView` uses `ResizeObserver` — if it only responds to `window.resize` events, you will need to trigger a manual fit after SplitPane mounts.

### Key Files to Create/Modify

| File | Action | Purpose |
|---|---|---|
| `src/shared/channels.ts` | Confirm/add | `TAB_CREATE_SPLIT` constant |
| `src/shared/ipc-types.ts` | Add types | `TabCreateSplitPayload`, `TabCreateSplitResponse` |
| `src/main/ipc-handlers.ts` | Add handler | Register `tab:create-split` ipcMain.handle |
| `src/renderer/state/tab-store.ts` | Update | `splitPairs`, `focusedPaneTabId`, `createSplit`, `removeSplitPair`, `getSplitPartner` |
| `src/renderer/components/SplitPane/SplitPane.tsx` | **Create** | Split layout component |
| `src/renderer/components/SplitPane/SplitPane.module.css` | **Create** | Split layout styles |
| `src/renderer/components/SplitPane/index.ts` | **Create** | Barrel export |
| `src/renderer/components/App.tsx` | Update | Render SplitPane when split pair exists |
| `src/renderer/components/TabBar/Tab.tsx` (or similar) | Update | Split indicator glyph |
| Keyboard handler (Story 2.3 location) | Update | Ctrl+Shift+D binding |
| `src/renderer/components/SplitPane/SplitPane.test.tsx` | **Create** | Component tests |

### Project Structure Notes

- The `SplitPane/` directory is entirely new. Create all four files simultaneously.
- `SplitDivider` is spec'd for Story P2-3.2 — in this story, use the static `.divider` div in SplitPane.module.css as a placeholder. Do NOT stub out the full SplitDivider component; just leave the placeholder div.
- `TerminalView` is the existing component from Epic 1; do not modify its internal API. Only its container dimensions change.
- Verify `src/renderer/components/Terminal/TerminalView.tsx` exports a `tabId` prop interface.

### References

- `docs/implementation-artifacts/1-3-terminal-core-powershell-via-node-pty-and-xterm-js.md` — TerminalView architecture (Epic 1)
- `docs/implementation-artifacts/2-3-hotkey-remapping-with-conflict-detection.md` — keyboard handler pattern (source of Ctrl+Shift+D hook location)
- `src/main/tab-manager.ts` — `createTab()` method signature (cwd param)
- `src/renderer/state/tab-store.ts` — existing signals to integrate with
- `docs/planning-artifacts/epics-v2.md` — P2-3 epic definition and Decision P2-4
