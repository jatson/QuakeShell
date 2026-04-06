# Story 5.2: Mouse-Drag Resize Handle

Status: ready-for-dev

## Story

As a developer,
I want to drag the bottom edge of the terminal to adjust its height,
so that I can set the terminal size that works best for my workflow without editing config manually.

## Acceptance Criteria

### AC 1: Resize Handle Renders at Bottom Edge
**Given** the terminal is visible
**When** the resize handle renders at the bottom edge
**Then** it is a 6px tall full-width bar with a centered 32×2px grip indicator
**And** default styles: `--border` background, grip in `--fg-dimmed`

### AC 2: Hover Visual Affordance
**Given** the resize handle
**When** the user hovers over it
**Then** the cursor changes to `ns-resize`, the handle background changes to `--accent` color, providing clear visual affordance

### AC 3: ARIA Attributes
**Given** the resize handle
**When** it is rendered
**Then** it has `role="separator"` and `aria-orientation="horizontal"` for accessibility

### AC 4: Real-Time Drag Resize
**Given** the user presses mousedown on the resize handle
**When** they drag vertically
**Then** the terminal height updates in real-time following the mouse Y position
**And** xterm.js reflows its content automatically to fit the new dimensions via the fit addon

### AC 5: Minimum Height Clamp
**Given** the user is dragging the resize handle
**When** they drag below 10% of screen height
**Then** the height clamps to 10%

### AC 6: Maximum Height Clamp
**Given** the user is dragging the resize handle
**When** they drag above 90% of screen height
**Then** the height clamps to 90%

### AC 7: Persist Height on Mouseup
**Given** the user releases the mouse (mouseup) after dragging
**When** the drag ends
**Then** the final height is calculated as a percentage of the current monitor's screen height
**And** the percentage is saved to `dropHeight` in the config via config-store (debounced — only on mouseup, not during drag)

### AC 8: Saved Height Applied on Next Toggle
**Given** the config `dropHeight` is updated
**When** the next toggle shows the terminal
**Then** the terminal opens at the saved height percentage

## Tasks / Subtasks

- [ ] Task 1: Create ResizeHandle Preact component (AC: #1, #2, #3)
  - [ ] 1.1 Create `src/renderer/components/ResizeHandle/ResizeHandle.tsx` as a default-exported Preact functional component
  - [ ] 1.2 Render a `<div>` with `role="separator"` and `aria-orientation="horizontal"`
  - [ ] 1.3 Inside the separator div, render a centered grip indicator element (32×2px)
  - [ ] 1.4 Create `src/renderer/components/ResizeHandle/ResizeHandle.module.css` with styles:
    - Container: `height: 6px`, `width: 100%`, `background: var(--border)`, `cursor: ns-resize`
    - Grip: `width: 32px`, `height: 2px`, `background: var(--fg-dimmed)`, centered horizontally
    - Hover state: container `background: var(--accent)`

- [ ] Task 2: Implement drag logic in the renderer (AC: #4, #5, #6)
  - [ ] 2.1 Add `onMouseDown` handler to the resize handle that initiates drag state
  - [ ] 2.2 On mousedown, attach `mousemove` and `mouseup` listeners to `document` (to capture drag outside the handle)
  - [ ] 2.3 During `mousemove`, calculate desired height from mouse Y position relative to screen/monitor top
  - [ ] 2.4 Clamp calculated height: minimum 10% of screen height, maximum 90% of screen height
  - [ ] 2.5 Send real-time resize IPC messages to the main process during drag (throttled at ~60fps via `requestAnimationFrame`)
  - [ ] 2.6 Call xterm.js `fitAddon.fit()` after each resize to reflow terminal content

- [ ] Task 3: Implement IPC channel for resize (AC: #4)
  - [ ] 3.1 Add `window:resize` channel constant to `src/shared/channels.ts`
  - [ ] 3.2 Expose `resize(height: number)` method in `src/preload/index.ts` via contextBridge
  - [ ] 3.3 In `src/main/window-manager.ts`, handle `window:resize` IPC — call `win.setBounds()` with new height while keeping x, y, width unchanged

- [ ] Task 4: Persist height to config on mouseup (AC: #7, #8)
  - [ ] 4.1 On `mouseup`, calculate the final height as a percentage of the current monitor's work area height
  - [ ] 4.2 Send `config:update` IPC (or use existing config-store mechanism) to save `dropHeight` with the computed percentage
  - [ ] 4.3 Verify that `src/shared/config-schema.ts` already supports `dropHeight` as a percentage (0-100 range) — adjust Zod validation if needed
  - [ ] 4.4 Clean up `mousemove` and `mouseup` listeners on drag end

- [ ] Task 5: Integrate ResizeHandle into terminal layout (AC: #1)
  - [ ] 5.1 Import and render `<ResizeHandle />` below the terminal content area in the main renderer layout
  - [ ] 5.2 Position the resize handle below the 2px accent line (from Story 5.1) at the very bottom of the window
  - [ ] 5.3 Ensure the resize handle does not overlap with xterm.js content area

- [ ] Task 6: Write tests (AC: #1, #2, #3, #4, #5, #6, #7)
  - [ ] 6.1 Create `src/renderer/components/ResizeHandle/ResizeHandle.test.tsx`
  - [ ] 6.2 Test: renders with correct ARIA attributes (`role="separator"`, `aria-orientation="horizontal"`)
  - [ ] 6.3 Test: grip indicator element is present
  - [ ] 6.4 Test: mousedown initiates drag state
  - [ ] 6.5 Test: height clamps to 10% minimum and 90% maximum
  - [ ] 6.6 Test: mouseup triggers config save with correct percentage
  - [ ] 6.7 Test: IPC `window:resize` is called during drag

## Dev Notes

### Drag Interaction Architecture

The resize interaction spans renderer and main processes:

```
Renderer (ResizeHandle)          Main (window-manager)
─────────────────────           ─────────────────────
mousedown → set dragging=true
mousemove → calc new height
         → ipc: window:resize ──→ win.setBounds({ height })
         → fitAddon.fit()
mouseup  → calc % of screen
         → ipc: config:update ──→ configStore.set('dropHeight', %)
         → cleanup listeners
```

### Height Calculation

During drag, the new height is derived from the mouse's screen Y position:
```typescript
// Mouse Y is relative to the screen top
// Terminal starts at screen top (drop-down style)
const newHeight = Math.round(event.screenY);
const screenHeight = window.screen.availHeight;
const clampedHeight = Math.max(screenHeight * 0.1, Math.min(screenHeight * 0.9, newHeight));
```

On mouseup, convert to percentage:
```typescript
const percentage = Math.round((clampedHeight / screenHeight) * 100);
// Save as dropHeight in config
```

### Real-Time Resize Performance

- Use `requestAnimationFrame` to throttle `setBounds` calls during mousemove — prevents overwhelming the main process
- Call `fitAddon.fit()` after each resize to ensure xterm.js recalculates rows/columns
- Do NOT save to config during drag — only persist on mouseup to avoid excessive disk writes

### setBounds Integration

The `window-manager.ts` already uses `setBounds` for animation (Epic 1). The resize handler must:
- Only modify `height` — keep `x`, `y`, `width` from current bounds
- Use `win.getBounds()` to read current position before applying new height
- Ensure this doesn't conflict with the slide animation (resize should only work when terminal is fully visible, not during animation)

### CSS Module Styles Reference

```css
/* ResizeHandle.module.css */
.handle {
  height: 6px;
  width: 100%;
  background: var(--border);
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  user-select: none;
}

.handle:hover {
  background: var(--accent);
}

.grip {
  width: 32px;
  height: 2px;
  background: var(--fg-dimmed);
  border-radius: 1px;
}
```

### Preventing Text Selection During Drag

During drag, add `user-select: none` to the document body or set `pointer-events: none` on the terminal iframe to prevent text selection while dragging. Clean up on mouseup.

### Testing Standards

- Component tests with `@testing-library/preact`
- Mock IPC calls (preload bridge) for resize and config update
- Simulate mouse events (mousedown → mousemove → mouseup sequences)
- Verify clamping logic with parameterized tests for edge values

### Project Structure Notes

| Action | File Path | Notes |
|--------|-----------|-------|
| CREATE | `src/renderer/components/ResizeHandle/ResizeHandle.tsx` | New Preact component, default export |
| CREATE | `src/renderer/components/ResizeHandle/ResizeHandle.module.css` | Styles using design tokens from Story 5.1 |
| CREATE | `src/renderer/components/ResizeHandle/ResizeHandle.test.tsx` | Co-located unit/component tests |
| MODIFY | `src/shared/channels.ts` | Add `window:resize` IPC channel constant |
| MODIFY | `src/preload/index.ts` | Expose `resize(height: number)` via contextBridge |
| MODIFY | `src/main/window-manager.ts` | Handle `window:resize` IPC, call `setBounds` with new height |
| MODIFY | `src/renderer/components/Terminal/TerminalView.tsx` | Import ResizeHandle, integrate into layout; call fitAddon.fit() on resize |
| MODIFY | `src/shared/config-schema.ts` | Verify `dropHeight` supports percentage range (may already be correct) |

### References

- **UX Design Specification**: `docs/planning-artifacts/ux-design-specification.md` — UX-DR10 (resize handle specs), UX-DR22 (drag interaction)
- **Architecture**: `docs/planning-artifacts/architecture.md` — IPC patterns, window-manager API, preload bridge
- **Epics & Stories**: `docs/planning-artifacts/epics.md` — Epic 5, Story 5.2
- **PRD**: `docs/planning-artifacts/prd.md` — FR terminal height adjustment
- **Dependencies**:
  - Story 5.1 (design tokens `--border`, `--fg-dimmed`, `--accent`)
  - Epic 1 Story 1.3 (`fitAddon` already initialized in TerminalView)
  - Epic 1 Story 1.4 (`window-manager.ts` with `setBounds`)
  - Epic 1 Story 1.2 (`config-store.ts` and `config-schema.ts` with `dropHeight`)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
