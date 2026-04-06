# Story P2-2.2: Tab Bar UI Component

Status: ready-for-dev

## Story

As a user,
I want a compact 32px tab bar above the terminal showing all open sessions,
so that I can see and switch between my terminal sessions at a glance.

## Acceptance Criteria

1. **Given** two or more tabs exist **When** the terminal is visible **Then** the tab bar renders at the top of the drop-down at exactly 32px height with `--bg-chrome` background color
2. **Given** a tab session **When** rendered as a Tab Item **Then** it shows a color dot (●), the tab name, and a hover-only × close button; the active tab has `--fg-primary` text, `--bg-terminal` background, and a 2px solid `--accent` left border; inactive tabs have `--fg-dimmed` text and no background
3. **Given** tabs that exceed the available width **When** the tab bar overflows **Then** horizontal scrolling is enabled via CSS (`overflow-x: auto`, `overflow-y: hidden`); tabs never wrap to a second row; the scrollbar is visually minimal (4px, `--border` color)
4. **Given** a click on a tab item **When** processed **Then** `window.quakeshell.tab.switchTo(tabId)` is called; the tab store's `activeTabId` signal updates which re-renders the tab bar immediately
5. **Given** a click on the × button of any tab **When** processed **Then** `window.quakeshell.tab.close(tabId)` is called; click event propagation to the parent tab item is prevented with `e.stopPropagation()`
6. **Given** click on the + (new tab) button **When** processed **Then** `window.quakeshell.tab.create()` is called with no options; `tabStore.tabs` signal updates via the `tab:active-changed` IPC event and the new tab renders immediately
7. **Given** only one tab exists **When** user clicks × on it **Then** `window.quakeshell.tab.close(tabId)` is still called and the terminal responds by hiding (handled by `TabManager.closeTab` emitting `tab:closed` which the last-tab hide logic intercepts in Task 8)
8. **Given** the tab bar and terminal together **When** the window renders **Then** total height = configured `dropHeight`% of screen; tab bar = exactly 32px; terminal area = `calc(100% - 32px)`; no overflow or layout shift
9. **Given** a tab is dragged over another tab **When** drag events fire **Then** a 2px `--accent` vertical line appears between tabs indicating the drop position; the dragging tab shows 0.7 opacity and a box-shadow
10. **Given** a tab is dropped onto a new position **When** `drop` event fires **Then** `tabStore.tabs` signal is reordered locally (renderer-only); no IPC call needed for reorder

## Tasks / Subtasks

- [ ] Task 1: Create `src/renderer/state/tab-store.ts` — tab signals + IPC bridge (AC: #4, #6, #10)
  - [ ] 1.1: Define and export signals:
    ```typescript
    import { signal, computed } from '@preact/signals';
    import type { TabSessionDTO } from '@shared/ipc-types';

    export const tabs = signal<TabSessionDTO[]>([]);
    export const activeTabId = signal<string | null>(null);

    export const activeTab = computed(() =>
      tabs.value.find(t => t.id === activeTabId.value) ?? null
    );
    ```
  - [ ] 1.2: Export `initTabStore(): Promise<void>` function:
    - Call `window.quakeshell.tab.list()` to populate `tabs.value`
    - Call `window.quakeshell.tab` to get the initial active tab — note: `tab:active-changed` is emitted by `init()` in TabManager; listen for it to set `activeTabId.value`
    - Register `window.quakeshell.tab.onData(...)` — store payload in a local `Map<tabId, string[]>` signal or dispatch to TerminalView via the event bus (see Task 6)
    - Register `window.quakeshell.tab.onClosed(({ tabId }) => { tabs.value = tabs.value.filter(t => t.id !== tabId) })`
    - Register `window.quakeshell.tab.onActiveChanged(({ tabId }) => { activeTabId.value = tabId })`
    - Register `window.quakeshell.tab.onExited(({ tabId }) => { /* mark tab as exited in signal — optional for this story */ })`
    - Register `window.quakeshell.tab.onRenamed(({ tabId, name }) => { tabs.value = tabs.value.map(t => t.id === tabId ? { ...t, manualName: name } : t) })`
  - [ ] 1.3: Export cleanup function `disposeTabStore(): void` that calls all unsubscribe functions returned by the `on*` calls
  - [ ] 1.4: Export `addTab(tab: TabSessionDTO): void` helper that appends to `tabs.value` and sets `activeTabId.value = tab.id`
  - [ ] 1.5: Export `reorderTabs(fromIndex: number, toIndex: number): void` for drag-and-drop reorder

- [ ] Task 2: Create `src/renderer/components/TabBar/TabBar.module.css` (AC: #1, #2, #3, #8, #9)
  ```css
  .tabBar {
    display: flex;
    align-items: center;
    height: 32px;
    min-height: 32px;
    max-height: 32px;
    background-color: var(--bg-chrome);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
    flex-shrink: 0;
    user-select: none;
  }

  .tabBar::-webkit-scrollbar { height: 4px; }
  .tabBar::-webkit-scrollbar-track { background: transparent; }
  .tabBar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  .tabList {
    display: flex;
    align-items: center;
    flex-shrink: 0;   /* prevent tab list from shrinking and forcing wrap */
    height: 100%;
  }

  .addButton,
  .settingsButton {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    border: none;
    background: none;
    color: var(--fg-dimmed);
    cursor: pointer;
    border-radius: 4px;
    font-size: 16px;
    transition: color 150ms, background-color 150ms;
  }

  .addButton:hover,
  .settingsButton:hover {
    color: var(--fg-primary);
    background-color: var(--border);
  }

  .settingsButton {
    margin-left: auto;    /* push to right end */
    margin-right: 2px;
  }

  .settingsIcon {
    display: inline-block;
    transition: transform 300ms ease;
  }

  .settingsButton:hover .settingsIcon {
    transform: rotate(90deg);
  }

  /* Drop indicator — positioned by JS via inline style */
  .dropIndicator {
    position: absolute;
    top: 2px;
    bottom: 2px;
    width: 2px;
    background: var(--accent);
    pointer-events: none;
    border-radius: 1px;
  }
  ```

- [ ] Task 3: Create `src/renderer/components/TabBar/TabItem.module.css` (AC: #2, #9)
  ```css
  .tabItem {
    display: flex;
    align-items: center;
    height: 28px;
    padding: 0 8px 0 6px;
    gap: 4px;
    flex-shrink: 0;
    cursor: pointer;
    color: var(--fg-dimmed);
    border-left: 2px solid transparent;
    border-radius: 0;
    transition: color 100ms, background-color 100ms;
    position: relative;
    white-space: nowrap;
  }

  .tabItem.active {
    color: var(--fg-primary);
    background-color: var(--bg-terminal);
    border-left-color: var(--accent);
  }

  .tabItem:not(.active):hover {
    color: var(--fg-primary);
    background-color: color-mix(in srgb, var(--bg-terminal) 40%, transparent);
  }

  /* Dragging state */
  .tabItem.dragging {
    opacity: 0.7;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .colorDot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tabName {
    font-size: 12px;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1;
  }

  .closeButton {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: none;
    background: none;
    color: inherit;
    cursor: pointer;
    border-radius: 3px;
    padding: 0;
    font-size: 11px;
    opacity: 0;
    flex-shrink: 0;
    transition: opacity 100ms, background-color 100ms;
  }

  .tabItem:hover .closeButton,
  .tabItem.active .closeButton {
    opacity: 1;
  }

  .closeButton:hover {
    background-color: color-mix(in srgb, var(--fg-primary) 20%, transparent);
  }
  ```

- [ ] Task 4: Create `src/renderer/components/TabBar/TabItem.tsx` (AC: #2, #4, #5, #9, #10)
  - [ ] 4.1: Define props interface:
    ```typescript
    interface TabItemProps {
      tab: TabSessionDTO;
      isActive: boolean;
      index: number;
      onClose: (tabId: string) => void;
      onSelect: (tabId: string) => void;
      onDragStart: (index: number) => void;
      onDragOver: (e: DragEvent, index: number) => void;
      onDrop: (e: DragEvent, index: number) => void;
    }
    ```
  - [ ] 4.2: Compute display name: `const displayName = tab.manualName ?? tab.shellType ?? 'Terminal'`
  - [ ] 4.3: Render structure:
    ```tsx
    <div
      class={`${styles.tabItem} ${isActive ? styles.active : ''} ${isDragging ? styles.dragging : ''}`}
      onClick={() => onSelect(tab.id)}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e, index); }}
      onDrop={(e) => { e.preventDefault(); onDrop(e, index); }}
    >
      <span class={styles.colorDot} style={{ backgroundColor: tab.color }} />
      <span class={styles.tabName}>{displayName}</span>
      <button
        class={styles.closeButton}
        onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
        title="Close tab"
        aria-label={`Close ${displayName}`}
      >×</button>
    </div>
    ```
  - [ ] 4.4: Track `isDragging` via a local `useSignal(false)` (or `useState`); set true on `dragStart`, false on `dragEnd`

- [ ] Task 5: Create `src/renderer/components/TabBar/TabBar.tsx` (AC: #1, #3, #6, #7, #9, #10)
  - [ ] 5.1: Import signals and store: `import { tabs, activeTabId, addTab, reorderTabs } from '../../state/tab-store'`
  - [ ] 5.2: Declare `dragSourceIndex = useSignal<number | null>(null)` and `dropTargetIndex = useSignal<number | null>(null)` for drag state
  - [ ] 5.3: Implement `handleAddTab`:
    ```typescript
    async function handleAddTab() {
      try {
        const newTab = await window.quakeshell.tab.create();
        addTab(newTab); // optimistic update before tab:active-changed arrives
      } catch (err) {
        console.error('Failed to create tab:', err);
      }
    }
    ```
  - [ ] 5.4: Implement `handleClose(tabId: string)`:
    ```typescript
    async function handleClose(tabId: string) {
      try {
        await window.quakeshell.tab.close(tabId);
        // tab:closed IPC event will update the signal; no manual update needed
      } catch (err) {
        console.error('Failed to close tab:', err);
      }
    }
    ```
  - [ ] 5.5: Implement `handleSelect(tabId: string)`:
    ```typescript
    async function handleSelect(tabId: string) {
      activeTabId.value = tabId; // optimistic
      await window.quakeshell.tab.switchTo(tabId).catch(console.error);
    }
    ```
  - [ ] 5.6: Implement drag-and-drop handlers:
    - `handleDragStart(index)`: sets `dragSourceIndex.value = index`
    - `handleDragOver(e: DragEvent, index)`: sets `dropTargetIndex.value = index`
    - `handleDrop(e: DragEvent, toIndex)`: calls `reorderTabs(dragSourceIndex.value!, toIndex)`, resets both signals to `null`
    - `handleDragEnd()`: reset both signals to `null`
  - [ ] 5.7: Render structure:
    ```tsx
    <div class={styles.tabBar}>
      <div class={styles.tabList} onDragEnd={handleDragEnd}>
        {tabs.value.map((tab, i) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId.value}
            index={i}
            onClose={handleClose}
            onSelect={handleSelect}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        ))}
        <button class={styles.addButton} onClick={handleAddTab} title="New tab (Ctrl+T)" aria-label="New tab">+</button>
      </div>
      <button class={styles.settingsButton} title="Settings (Ctrl+,)" aria-label="Open settings">
        <span class={styles.settingsIcon}>⚙</span>
      </button>
    </div>
    ```
  - [ ] 5.8: Export as `export default function TabBar() { ... }`

- [ ] Task 6: Update `src/renderer/components/App.tsx` to include TabBar (AC: #8)
  - [ ] 6.1: Import `TabBar` and `initTabStore`
  - [ ] 6.2: Call `initTabStore()` inside `useEffect(() => { initTabStore() }, [])` (alongside the existing `window.quakeshell.config.getAll()` effect)
  - [ ] 6.3: Wrap terminal in a flex-column container and place `<TabBar />` above `<TerminalView>`:
    ```tsx
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <TabBar />
        <div style={{ flex: 1, minHeight: 0 }}>
          <TerminalView
            tabId={activeTabId.value}
            opacity={opacity.value}
            fontSize={fontSize.value}
            fontFamily={fontFamily.value}
          />
        </div>
        <OnboardingOverlay />
      </div>
    );
    ```
  - [ ] 6.4: Note: `TerminalView` will need a `tabId` prop (Story P2-2.x — TerminalView multi-tab wiring) — for now, pass `tabId` as a prop even if `TerminalView` ignores it; this avoids a blocking dependency

- [ ] Task 7: Update `TerminalView` to receive and route by `tabId` (partial, non-blocking) (AC: #4)
  - [ ] 7.1: Add optional `tabId?: string | null` to `TerminalViewProps` interface
  - [ ] 7.2: Change the xterm `onData` handler to call `window.quakeshell.tab.input(tabId, data)` when `tabId` is set, falling back to `window.quakeshell.terminal.write(data)` when `tabId` is null (backward compat)
  - [ ] 7.3: Change the `window.quakeshell.terminal.onData` subscription to check `tabId`: when a `tabId` is present, use `window.quakeshell.tab.onData` filtered to the active tab instead

- [ ] Task 8: Handle "last tab closed = hide terminal" in main process (AC: #7)
  - [ ] 8.1: In `src/main/tab-manager.ts`, in `closeTab()` after deleting from Map: if `tabs.size === 0`, call `windowManager.hide()` (import `* as windowManager from './window-manager'`)
  - [ ] 8.2: After hiding, call `createTab({})` to create a fresh default session so the terminal is ready for the next toggle

- [ ] Task 9: Write component tests in `src/renderer/components/TabBar/TabBar.test.tsx` (AC: #2, #4, #5, #6)
  - [ ] 9.1: Mock `window.quakeshell.tab` with `vi.stubGlobal`:
    ```typescript
    const mockTab = {
      create: vi.fn().mockResolvedValue({ id: 'new-id', shellType: 'powershell', color: '#7aa2f7', createdAt: Date.now() }),
      close: vi.fn().mockResolvedValue(undefined),
      switchTo: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      onData: vi.fn().mockReturnValue(() => {}),
      onClosed: vi.fn().mockReturnValue(() => {}),
      onActiveChanged: vi.fn().mockReturnValue(() => {}),
      onExited: vi.fn().mockReturnValue(() => {}),
      onRenamed: vi.fn().mockReturnValue(() => {}),
    };
    vi.stubGlobal('quakeshell', { tab: mockTab });
    ```
  - [ ] 9.2: Test that tab bar renders with two tabs and marks one as active (verify `--accent` border class)
  - [ ] 9.3: Test clicking a tab calls `switchTo(tabId)`
  - [ ] 9.4: Test clicking × calls `close(tabId)` and does NOT call `switchTo`
  - [ ] 9.5: Test clicking + calls `create()`
  - [ ] 9.6: Test that tab bar renders with single tab (no crash)
  - [ ] 9.7: Test that the settings button renders (⚙ text or aria-label present)

## Dev Notes

### Architecture Patterns

**Signal-based reactivity:** `tabs` and `activeTabId` are module-level signals in `tab-store.ts`. Components read `tabs.value` and `activeTabId.value` directly — Preact signals auto-subscribe components that read `.value`. No prop-drilling of tab state needed.

**Optimistic updates:** For `handleSelect`, set `activeTabId.value` immediately before the IPC call returns. This makes the UI feel instant (NFR-P2-01: <16ms). The `tab:active-changed` event from main will confirm shortly after.

**Drag-and-drop:** Uses native HTML5 API only — no library. The reorder is renderer-only (`reorderTabs` mutates `tabs.value`). Main process never knows about tab ordering; order is what the user sees in the tab bar, not persisted.

**Tab display name priority (UX-DR-P2-08):** In `TabItem.tsx`, compute: `tab.manualName ?? tab.shellType ?? 'Terminal'`. The full auto-naming chain (git repo → process name → shell type → cwd) is deferred to a later story. For this story, `shellType` as the default name is sufficient.

**`min-height: 0` on terminal container:** Required when using `flex: 1` in a flex column — without this, the terminal div will not shrink below its content size and will overflow the window.

**CSS design tokens:** All token names (`--bg-chrome`, `--bg-terminal`, `--fg-primary`, `--fg-dimmed`, `--accent`, `--border`) must be defined in the global CSS (likely `src/renderer/theme/tokyo-night.css` or a `:root` block in `index.css`). If they are not yet defined as CSS custom properties, add them pointing to the Tokyo Night palette values as a prerequisite.

### Key Files to Create/Modify

| File | Action | Notes |
|---|---|---|
| `src/renderer/state/tab-store.ts` | CREATE | Signal store + IPC bridge |
| `src/renderer/components/TabBar/TabBar.tsx` | CREATE | Main tab bar component |
| `src/renderer/components/TabBar/TabItem.tsx` | CREATE | Individual tab item |
| `src/renderer/components/TabBar/TabBar.module.css` | CREATE | Tab bar styles |
| `src/renderer/components/TabBar/TabItem.module.css` | CREATE | Tab item styles |
| `src/renderer/components/TabBar/TabBar.test.tsx` | CREATE | Component tests |
| `src/renderer/components/App.tsx` | MODIFY | Add TabBar, adjust layout |
| `src/renderer/components/Terminal/TerminalView.tsx` | MODIFY | Add tabId prop, route IPC |
| `src/main/tab-manager.ts` | MODIFY | Add last-tab hide + recreate logic |

### CSS Token Values (Tokyo Night reference)

If CSS custom properties are not yet in global CSS, define in `:root`:
```css
:root {
  --bg-terminal: #1a1b26;
  --bg-chrome:   #16161e;
  --fg-primary:  #c0caf5;
  --fg-dimmed:   #565f89;
  --accent:      #7aa2f7;
  --border:      #292e42;
}
```

### Project Structure Notes

- Create `src/renderer/components/TabBar/` directory with all four files (component + CSS + test).
- The `+` button and Settings `⚙` button live inside `TabBar.tsx`, not `TabItem.tsx`.
- `TabBar.tsx` should be a **default export**: `export default function TabBar() { ... }`.
- `TabItem.tsx` can be a named export: `export function TabItem(props: TabItemProps) { ... }`.
- The `index.ts` barrel file for TabBar is optional; App.tsx can import directly from the file path.

### References

- `src/renderer/state/config-store.ts` — pattern for signal initialization + IPC subscription
- `src/renderer/components/App.tsx` — current layout to understand what to modify
- `docs/planning-artifacts/epics-v2.md` — UX-DR-P2-01 through UX-DR-P2-06 for exact visual specs
- `src/shared/ipc-types.ts` — `QuakeShellTabAPI` and `TabSessionDTO` (added in P2-2.1)
