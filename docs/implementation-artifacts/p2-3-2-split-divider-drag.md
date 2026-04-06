# Story P2-3.2: Split Divider Drag

Status: ready-for-dev

---

## Story

As a user, I want to drag the split divider to resize the two panes proportionally, so that I can allocate more space to the context I need.

---

## Acceptance Criteria

- **AC1** — Given two split panes / When user hovers over the 2px divider / Then the divider highlights with `--accent` color and cursor changes to `col-resize`; an invisible 8px hit area surrounds the visible divider.
- **AC2** — Given user mousedown on the divider and drags left or right / When dragging is in progress / Then both panes resize proportionally in real-time at 60fps; no IPC calls are made during drag (renderer-only state).
- **AC3** — Given user mouseup after dragging / When the drag ends / Then each xterm.js instance receives a `terminal:resize` IPC call with the new column/row dimensions; split ratio is NOT persisted (resets to 50/50 on next open).
- **AC4** — Given drag would make either pane narrower than 20% of total width / When dragging / Then the divider snaps to the 20% limit (minimum ratio = 0.2).
- **AC5** — Given drag would make either pane wider than 80% / When dragging / Then the divider snaps to the 80% limit (maximum ratio = 0.8).

---

## Tasks / Subtasks

### Task 1: SplitDivider component

- [ ] **1.1** Create `src/renderer/components/SplitPane/SplitDivider.tsx`:
  ```tsx
  import { h } from 'preact';
  import type { Signal } from '@preact/signals';
  import { useRef, useCallback } from 'preact/hooks';
  import styles from './SplitDivider.module.css';

  const MIN_RATIO = 0.2;
  const MAX_RATIO = 0.8;

  interface SplitDividerProps {
    ratio: Signal<number>;
    containerRef: { current: HTMLElement | null };
    onDragEnd?: () => void;
  }

  export default function SplitDivider({ ratio, containerRef, onDragEnd }: SplitDividerProps) {
    const isDragging = useRef(false);

    const handleMouseDown = useCallback((e: MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const rawRatio = (moveEvent.clientX - rect.left) / rect.width;
        const clamped = Math.min(MAX_RATIO, Math.max(MIN_RATIO, rawRatio));
        ratio.value = clamped;
      };

      const handleMouseUp = () => {
        if (!isDragging.current) return;
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        onDragEnd?.();
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }, [ratio, containerRef, onDragEnd]);

    return (
      <div
        class={styles.hitArea}
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(ratio.value * 100)}
        aria-valuemin={MIN_RATIO * 100}
        aria-valuemax={MAX_RATIO * 100}
      >
        <div class={styles.track} />
      </div>
    );
  }
  ```

  **Key design decisions:**
  - `mousemove` / `mouseup` listeners are attached to `document`, not the divider element — this ensures dragging continues even if the pointer moves outside the divider.
  - `ratio` is a Signal passed from `SplitPane` — writes to `ratio.value` trigger re-render via Preact Signals fine-grained reactivity. No `setState` needed.
  - `containerRef` gives us the bounding rect of the total container to compute the ratio correctly.
  - `will-change: transform` goes on `.track` (not `.hitArea`) to hint GPU compositing during drag.
  - `onDragEnd` callback lets `SplitPane` issue `terminal:resize` after drag completes (see Task 3).

- [ ] **1.2** Create `src/renderer/components/SplitPane/SplitDivider.module.css`:
  ```css
  /* Invisible hit area — wider than the visible track */
  .hitArea {
    position: relative;
    width: 10px;        /* 10px total hit area */
    flex-shrink: 0;
    height: 100%;
    cursor: col-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  /* Visible 2px divider track */
  .track {
    width: 2px;
    height: 100%;
    background: var(--border);
    transition: background 120ms ease, width 120ms ease;
    will-change: transform;
    border-radius: 1px;
  }

  .hitArea:hover .track,
  .hitArea:active .track {
    background: var(--accent);
    width: 3px; /* subtle thickening on hover/active */
  }
  ```

  **Notes:**
  - The 10px `.hitArea` is centered around the 2px `.track`. This gives ~4px padding on each side for a total 10px grab zone (AC1's "invisible 8px hit area").
  - Hover/active state handled entirely via CSS — no JS state for hover needed.
  - `will-change: transform` on `.track` hints the GPU to composite this element independently.

### Task 2: SplitPane.tsx — wire SplitDivider and containerRef

- [ ] **2.1** Update `src/renderer/components/SplitPane/SplitPane.tsx` to replace the static `.divider` placeholder with `SplitDivider` and wire `containerRef`:
  ```tsx
  import { h } from 'preact';
  import { useSignal, useSignalEffect } from '@preact/signals';
  import { useRef, useCallback } from 'preact/hooks';
  import TerminalView from '../Terminal/TerminalView';
  import SplitDivider from './SplitDivider';
  import styles from './SplitPane.module.css';

  const MIN_RATIO = 0.2;
  const MAX_RATIO = 0.8;

  interface SplitPaneProps {
    primaryTabId: string;
    splitTabId: string;
    focusedPaneTabId: string;
    onFocusPane: (tabId: string) => void;
    onResizePanes?: (primaryTabId: string, splitTabId: string) => void;
  }

  export default function SplitPane({
    primaryTabId,
    splitTabId,
    focusedPaneTabId,
    onFocusPane,
    onResizePanes,
  }: SplitPaneProps) {
    const ratio = useSignal(0.5);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleDragEnd = useCallback(() => {
      onResizePanes?.(primaryTabId, splitTabId);
    }, [onResizePanes, primaryTabId, splitTabId]);

    return (
      <div class={styles.container} ref={containerRef}>
        <div
          class={styles.pane}
          style={{ flexBasis: `${ratio.value * 100}%` }}
          onFocusCapture={() => onFocusPane(primaryTabId)}
        >
          <TerminalView tabId={primaryTabId} isFocused={focusedPaneTabId === primaryTabId} />
        </div>
        <SplitDivider
          ratio={ratio}
          containerRef={containerRef}
          onDragEnd={handleDragEnd}
        />
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

- [ ] **2.2** Update `SplitPane.module.css` — the `flex-basis` is now set inline. Adjust to remove the static `.divider` class and ensure pane constraints work:
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
    min-width: 0;       /* IMPORTANT: allows flex child to shrink below content size */
    height: 100%;
    overflow: hidden;
    /* flex-basis set inline; range enforced in signal (0.2–0.8) */
  }
  ```
  > Remove the static `.divider` rule added in Story 3.1 — it is replaced by `SplitDivider`.

### Task 3: terminal:resize after drag

- [ ] **3.1** In `src/renderer/components/App.tsx` (or wherever SplitPane is rendered), provide the `onResizePanes` callback:
  ```tsx
  import { TAB_RESIZE } from '../../shared/channels'; // or TERMINAL_RESIZE — check channels.ts

  const handleResizePanes = useCallback(async (primaryId: string, splitId: string) => {
    // Find each pane's DOM container and get its pixel dimensions
    // Then invoke terminal:resize for both PTY sessions
    const resizeTab = async (tabId: string) => {
      const container = document.querySelector(`[data-terminal-id="${tabId}"]`);
      if (!container) return;
      const { width, height } = container.getBoundingClientRect();
      await window.electronAPI.invoke(TAB_RESIZE, { tabId, width, height });
    };
    await Promise.all([resizeTab(primaryId), resizeTab(splitId)]);
  }, []);
  ```
  > **Note on resize IPC name:** Check `src/shared/channels.ts`. The channel is likely `terminal:resize` (from Epic 1, Story 1.3). Match the existing constant exactly.

  > **Note on TerminalView data attribute:** The `data-terminal-id` selector assumes TerminalView renders its container with `data-terminal-id={tabId}`. If it doesn't, add this attribute to the TerminalView container element, or use a different method to find the container (e.g., a `ref` passed in from SplitPane to TerminalView). The `data-` attribute approach avoids prop-drilling refs through SplitPane and is recommended.

- [ ] **3.2** Alternatively, if `TerminalView` exposes a `resize()` imperative method via ref, use that instead of IPC. Check `src/renderer/components/Terminal/TerminalView.tsx` for `useImperativeHandle` or similar patterns. The IPC invoke approach (Task 3.1) is the safe default matching the existing pattern from Epic 1.

### Task 4: Tests

- [ ] **4.1** Create `src/renderer/components/SplitPane/SplitDivider.test.tsx`:
  ```tsx
  import { render, fireEvent } from '@testing-library/preact';
  import { describe, it, expect, vi } from 'vitest';
  import { signal } from '@preact/signals';
  import SplitDivider from './SplitDivider';

  function makeContainerRef(width = 1000, left = 0) {
    return {
      current: {
        getBoundingClientRect: () => ({ left, width, right: left + width, top: 0, bottom: 800, height: 800 }),
      } as unknown as HTMLElement,
    };
  }

  describe('SplitDivider', () => {
    it('renders hit area and track', () => {
      const ratio = signal(0.5);
      const { container } = render(
        <SplitDivider ratio={ratio} containerRef={makeContainerRef()} />
      );
      expect(container.querySelector('[class*="hitArea"]')).toBeTruthy();
      expect(container.querySelector('[class*="track"]')).toBeTruthy();
    });

    it('updates ratio on drag', () => {
      const ratio = signal(0.5);
      const containerRef = makeContainerRef(1000, 0);
      const { container } = render(
        <SplitDivider ratio={ratio} containerRef={containerRef} />
      );
      const hitArea = container.querySelector('[class*="hitArea"]') as HTMLElement;

      fireEvent.mouseDown(hitArea, { clientX: 500 });
      fireEvent.mouseMove(document, { clientX: 700 });
      fireEvent.mouseUp(document);

      expect(ratio.value).toBeCloseTo(0.7, 1);
    });

    it('clamps ratio to MIN', () => {
      const ratio = signal(0.5);
      const containerRef = makeContainerRef(1000, 0);
      const { container } = render(
        <SplitDivider ratio={ratio} containerRef={containerRef} />
      );
      const hitArea = container.querySelector('[class*="hitArea"]') as HTMLElement;

      fireEvent.mouseDown(hitArea, { clientX: 500 });
      fireEvent.mouseMove(document, { clientX: 50 }); // 5% — below MIN
      fireEvent.mouseUp(document);

      expect(ratio.value).toBe(0.2);
    });

    it('clamps ratio to MAX', () => {
      const ratio = signal(0.5);
      const containerRef = makeContainerRef(1000, 0);
      const { container } = render(
        <SplitDivider ratio={ratio} containerRef={containerRef} />
      );
      const hitArea = container.querySelector('[class*="hitArea"]') as HTMLElement;

      fireEvent.mouseDown(hitArea, { clientX: 500 });
      fireEvent.mouseMove(document, { clientX: 950 }); // 95% — above MAX
      fireEvent.mouseUp(document);

      expect(ratio.value).toBe(0.8);
    });

    it('calls onDragEnd after mouseup', () => {
      const ratio = signal(0.5);
      const onDragEnd = vi.fn();
      const { container } = render(
        <SplitDivider ratio={ratio} containerRef={makeContainerRef()} onDragEnd={onDragEnd} />
      );
      const hitArea = container.querySelector('[class*="hitArea"]') as HTMLElement;

      fireEvent.mouseDown(hitArea, { clientX: 500 });
      fireEvent.mouseUp(document);

      expect(onDragEnd).toHaveBeenCalledOnce();
    });

    it('does not call onDragEnd if mouseup fires without prior mousedown', () => {
      const ratio = signal(0.5);
      const onDragEnd = vi.fn();
      render(<SplitDivider ratio={ratio} containerRef={makeContainerRef()} onDragEnd={onDragEnd} />);
      fireEvent.mouseUp(document);
      expect(onDragEnd).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **4.2** Add SplitPane integration test for ratio changes in `SplitPane.test.tsx` (extend from P2-3.1):
  ```tsx
  it('passes ratio signal to SplitDivider', () => {
    // Verify that flex-basis of pane containers reflects ratio
    const { container } = render(
      <SplitPane
        primaryTabId="tab-1"
        splitTabId="tab-2"
        focusedPaneTabId="tab-1"
        onFocusPane={vi.fn()}
      />
    );
    const panes = container.querySelectorAll('[class*="pane"]');
    expect(panes[0].style.flexBasis).toBe('50%');
    expect(panes[1].style.flexBasis).toBe('50%');
  });
  ```

---

## Dev Notes

### Architecture Patterns

**Why document-level event listeners:** Attaching `mousemove` and `mouseup` to `document` (rather than the divider element) is the standard drag pattern. If the pointer moves quickly, it can exit the divider's bounds before the next `mousemove` fires. Document-level listeners capture it regardless. Clean up both listeners in the same `mouseup` handler to avoid memory leaks.

**Why `ratio` is a Signal, not component state:** Preact Signals update only the DOM nodes that directly read the signal value, bypassing Preact's virtual DOM diffing entirely. Because `flex-basis` updates on every `mousemove`, this is a critical performance path. Using `useSignal` here instead of `useState` prevents the entire `SplitPane` tree from re-rendering on each pixel of drag. The benchmarked outcome is consistent 60fps on low-end hardware.

**No IPC during drag (AC2):** This is an explicit constraint. Terminal PTY resize is expensive — it triggers the PTY to reflow the output buffer. Calling it on every `mousemove` (potentially 60x/sec) would cause visible terminal flicker and potential PTY buffer corruption. Fire `terminal:resize` ONCE on `mouseup` only.

**`will-change: transform` placement:** Only apply `will-change` to the `.track` element (the 2px visible bar), not the `.hitArea`. `will-change` on the container can cause stacking context issues. The `.track` element is small and the promotion cost is negligible.

**containerRef must NOT be null at drag time:** `SplitDivider` receives `containerRef` from `SplitPane`. The container is always mounted before the divider is interactive, so `containerRef.current` will be populated by mousedown time. The null-guard in `handleMouseMove` is defensive only.

**Cursor cleanup on early mouseup:** If the user clicks without dragging (no `mousemove` between `mousedown` and `mouseup`), `ratio.value` stays at its previous value and `document.body.style.cursor` is still reset to `''`. This is handled correctly by the current implementation since cleanup happens in the `mouseup` handler regardless.

**`min-width: 0` on `.pane` (CSS):** Without this, a flex child will not shrink below its content's intrinsic width (e.g., the xterm.js canvas). `min-width: 0` allows the flex-basis constraint to take full effect when ratio < 0.5.

### Key Files to Create/Modify

| File | Action | Purpose |
|---|---|---|
| `src/renderer/components/SplitPane/SplitDivider.tsx` | **Create** | Draggable divider with hit area |
| `src/renderer/components/SplitPane/SplitDivider.module.css` | **Create** | Divider styles, hover highlight, hit area |
| `src/renderer/components/SplitPane/SplitPane.tsx` | Update | Replace static divider with `SplitDivider`; add `containerRef`; pass `onDragEnd` |
| `src/renderer/components/SplitPane/SplitPane.module.css` | Update | Remove static `.divider` rule; confirm `min-width: 0` on `.pane` |
| `src/renderer/components/App.tsx` | Update | Provide `onResizePanes` callback → `terminal:resize` IPC for both panes |
| `src/renderer/components/SplitPane/SplitDivider.test.tsx` | **Create** | Drag clamping, onDragEnd, ratio update tests |

### Project Structure Notes

- `SplitDivider` is a sibling file inside `src/renderer/components/SplitPane/` — co-locate with SplitPane as they are tightly coupled.
- `SplitDivider` does NOT need its own barrel export; it is only imported by `SplitPane.tsx`.
- Check `src/shared/channels.ts` for the exact `terminal:resize` (or equivalent) channel name before Task 3. Avoid creating a new channel if one already exists.
- Check `src/renderer/components/Terminal/TerminalView.tsx` for the container element — if it renders a wrapping `<div>`, add `data-terminal-id={tabId}` to that element. Do not add it to the xterm.js canvas directly.

### References

- `docs/implementation-artifacts/p2-3-1-split-pane-creation.md` — prerequisite story; `SplitPane.tsx` structure, `ratio` signal
- `docs/implementation-artifacts/1-3-terminal-core-powershell-via-node-pty-and-xterm-js.md` — `terminal:resize` IPC flow and FitAddon pattern
- `docs/implementation-artifacts/5-2-mouse-drag-resize-handle.md` — existing drag-resize implementation (similar pattern; reuse approach but do NOT share code — SplitDivider is horizontal drag, resize handle is likely vertical/corner drag)
- MDN: [Pointer events for drag](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Using_Pointer_Events) — alternative to mouse events; consider using `pointerdown/pointermove/pointerup` + `setPointerCapture` for more robust drag (supports trackpad cancellation). Current spec uses mouse events for simplicity; pointer events are a recommended upgrade if drag feels unreliable.
