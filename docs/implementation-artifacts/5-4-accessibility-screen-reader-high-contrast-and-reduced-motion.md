# Story 5.4: Accessibility — Screen Reader, High Contrast, and Reduced Motion

Status: ready-for-dev

## Story

As a user with accessibility needs,
I want QuakeShell to support screen readers, high contrast mode, and reduced motion preferences,
so that I can use the terminal regardless of visual or motor accessibility requirements.

## Acceptance Criteria

### AC 1: Screen Reader Support via xterm.js
**Given** the xterm.js Terminal instance
**When** it initializes
**Then** the xterm.js accessibility addon is enabled, allowing screen readers (NVDA, Narrator) to announce terminal output, and supporting character, word, and line navigation

### AC 2: Reduced Motion — All Animations Disabled
**Given** the operating system has `prefers-reduced-motion: reduce` enabled
**When** QuakeShell renders animations
**Then** all animations run with 0ms duration — terminal show/hide becomes instant (no slide), settings gear rotation is disabled, hover transitions are instant
**And** the CSS rule `@media (prefers-reduced-motion: reduce) { * { animation-duration: 0ms !important; transition-duration: 0ms !important; } }` is applied in `global.css`

### AC 3: High Contrast Mode — System Colors
**Given** Windows High Contrast mode is active
**When** QuakeShell renders its UI
**Then** the CSS `@media (forced-colors: active)` override applies: all custom colors are replaced with system colors, transparency is disabled (opacity set to 100%), and bold outline-based focus indicators are used instead of subtle color highlights

### AC 4: High Contrast — Opaque Terminal
**Given** High Contrast mode is active
**When** the terminal is toggled
**Then** the terminal background is fully opaque (no transparency) to ensure maximum readability with system colors

### AC 5: DPI Scaling — 100% Baseline
**Given** the terminal UI at 100% Windows DPI scaling (96 DPI)
**When** the interface renders
**Then** all elements display at their designed pixel sizes — 6px resize handle, 2px accent line, 4px grid spacing

### AC 6: DPI Scaling — 125%, 150%, 200%
**Given** the terminal UI at 125%, 150%, or 200% Windows DPI scaling
**When** the interface renders
**Then** Electron/Chromium applies automatic DPI scaling, the 4px spacing grid scales cleanly (5px, 6px, 8px respectively), and hit areas for the resize handle (6px) remain grabbable at all scale levels

### AC 7: Onboarding Overlay Screen Reader Attributes
**Given** a screen reader user
**When** the onboarding overlay displays
**Then** the overlay's `role="dialog"`, `aria-modal="true"`, and `aria-label="Welcome to QuakeShell"` attributes are announced, and focus is trapped within the dialog until dismissal

## Tasks / Subtasks

- [ ] Task 1: Enable xterm.js screen reader mode (AC: #1)
  - [ ] 1.1 In `src/renderer/components/Terminal/TerminalView.tsx`, add `screenReaderMode: true` to the Terminal constructor options
  - [ ] 1.2 Verify xterm.js v6 includes screen reader support in core (no separate addon needed — the `screenReaderMode` option enables an accessible live region)
  - [ ] 1.3 Ensure the xterm.js terminal container has appropriate ARIA attributes (`role="document"` or similar) that screen readers can discover
  - [ ] 1.4 Test with Windows Narrator: verify terminal output is announced as it appears
  - [ ] 1.5 Test with NVDA (if available): verify character, word, and line navigation within the terminal buffer

- [ ] Task 2: Add reduced motion media query (AC: #2)
  - [ ] 2.1 In `src/renderer/global.css`, add the `@media (prefers-reduced-motion: reduce)` rule:
    ```css
    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: 0ms !important;
        transition-duration: 0ms !important;
      }
    }
    ```
  - [ ] 2.2 In `src/main/window-manager.ts`, detect `prefers-reduced-motion` preference and set slide animation duration to 0ms
  - [ ] 2.3 Expose a way for the main process to query the reduced-motion preference — use `nativeTheme` or query via IPC from renderer's `window.matchMedia('(prefers-reduced-motion: reduce)')`
  - [ ] 2.4 When reduced motion is active, the toggle should instant-show/instant-hide (setBounds to final position immediately, skip animation frames)
  - [ ] 2.5 Listen for changes to the `prefers-reduced-motion` media query (user may toggle it at runtime) and update animation behavior dynamically

- [ ] Task 3: Add high contrast mode support (AC: #3, #4)
  - [ ] 3.1 In `src/renderer/global.css`, add the `@media (forced-colors: active)` rule:
    ```css
    @media (forced-colors: active) {
      :root {
        --bg-terminal: Canvas;
        --bg-chrome: Canvas;
        --fg-primary: CanvasText;
        --fg-dimmed: GrayText;
        --accent: Highlight;
        --border: ButtonBorder;
      }

      * {
        forced-color-adjust: auto;
      }

      /* Override transparency */
      .terminal-window {
        opacity: 1 !important;
      }

      /* Bold focus indicators */
      :focus-visible {
        outline: 2px solid Highlight !important;
        outline-offset: 2px !important;
      }
    }
    ```
  - [ ] 3.2 In `src/main/window-manager.ts`, detect forced-colors / high contrast mode and override window opacity to 100%
  - [ ] 3.3 Use `nativeTheme.shouldUseHighContrastColors` (Electron API) to detect high contrast mode in the main process
  - [ ] 3.4 When high contrast is detected, send IPC to renderer to apply high contrast class or rely on CSS media query
  - [ ] 3.5 Ensure the xterm.js terminal also respects high contrast — the `forced-colors` media query should override the ITheme colors via CSS

- [ ] Task 4: Verify DPI scaling behavior (AC: #5, #6)
  - [ ] 4.1 Verify Electron's `BrowserWindow` is created without `enableLargerThanScreen` or other flags that might break DPI scaling
  - [ ] 4.2 Test at 100% DPI (96 DPI): verify 6px resize handle, 2px accent line, 4px spacing render at exact pixel sizes
  - [ ] 4.3 Test at 125% DPI: verify elements scale proportionally, resize handle remains grabbable
  - [ ] 4.4 Test at 150% DPI: verify spacing grid scales (4px → 6px logical), no sub-pixel rendering artifacts
  - [ ] 4.5 Test at 200% DPI: verify all elements scale cleanly (4px → 8px logical), hit targets are adequate
  - [ ] 4.6 Document DPI test results in a manual test checklist

- [ ] Task 5: Ensure onboarding overlay accessibility (AC: #7)
  - [ ] 5.1 Verify `OnboardingOverlay.tsx` has `role="dialog"`, `aria-modal="true"`, and `aria-label="Welcome to QuakeShell"` attributes
  - [ ] 5.2 Verify focus trap is implemented in the onboarding overlay (Tab/Shift+Tab cycles within the dialog)
  - [ ] 5.3 Add focus trap logic if not present: on mount, focus the first focusable element; on Tab at last element, cycle to first; on Shift+Tab at first, cycle to last
  - [ ] 5.4 Verify Escape key dismisses the overlay and restores focus to the terminal
  - [ ] 5.5 Test with Narrator: confirm dialog announcement, focus trap behavior, and dismiss interaction

- [ ] Task 6: Write tests (AC: #1, #2, #3, #4, #7)
  - [ ] 6.1 Unit test: verify `screenReaderMode: true` is passed to Terminal constructor
  - [ ] 6.2 Unit test: verify `global.css` contains `@media (prefers-reduced-motion: reduce)` rule (CSS snapshot or regex test)
  - [ ] 6.3 Unit test: verify `global.css` contains `@media (forced-colors: active)` rule
  - [ ] 6.4 Unit test: window-manager sets animation duration to 0 when reduced-motion is active
  - [ ] 6.5 Unit test: window-manager sets opacity to 100% when high contrast is detected
  - [ ] 6.6 Component test: OnboardingOverlay renders with correct ARIA attributes
  - [ ] 6.7 Component test: OnboardingOverlay traps focus within dialog
  - [ ] 6.8 Create manual DPI testing checklist document

## Dev Notes

### Screen Reader Mode in xterm.js v6

In xterm.js v6, screen reader support is built into the core library. Enable it via the Terminal constructor option:

```typescript
const terminal = new Terminal({
  screenReaderMode: true,
  // ... other options
});
```

This creates a hidden live region (`aria-live="assertive"`) that announces new terminal output. Screen readers can then use their buffer navigation commands (e.g., NVDA's review cursor) to read terminal content.

**Important**: `screenReaderMode` has a performance cost — it maintains an accessible buffer. This is acceptable for QuakeShell since it's a single terminal instance.

### Reduced Motion Detection

**CSS layer** (renderer):
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0ms !important;
    transition-duration: 0ms !important;
  }
}
```

**JavaScript layer** (main process — for slide animation):
```typescript
// In window-manager.ts
const prefersReducedMotion = (): boolean => {
  // Query from renderer via IPC, or use nativeTheme
  return nativeTheme.shouldUseInvertedColorScheme; // Not exact; better to query renderer
};

// Alternative: query renderer on init
// renderer sends: matchMedia('(prefers-reduced-motion: reduce)').matches
```

The CSS rule handles all renderer-side animations. The main process needs its own detection for the `setBounds` slide animation, which is driven by JavaScript, not CSS.

**Runtime changes**: Use `matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', callback)` in the renderer to detect when the user toggles the setting without restarting QuakeShell.

### High Contrast Mode

**Electron API:**
```typescript
import { nativeTheme } from 'electron';

// Check high contrast
const isHighContrast = nativeTheme.shouldUseHighContrastColors;

// Listen for changes
nativeTheme.on('updated', () => {
  const isHC = nativeTheme.shouldUseHighContrastColors;
  // Send to renderer or update main process behavior
});
```

**CSS forced-colors**: The `@media (forced-colors: active)` query automatically activates when Windows High Contrast mode is on. System color keywords (`Canvas`, `CanvasText`, `Highlight`, `GrayText`, `ButtonBorder`) map to the user's chosen high contrast theme.

**Opacity override**: When high contrast is active, transparency must be disabled for readability. In main process:
```typescript
if (nativeTheme.shouldUseHighContrastColors) {
  win.setOpacity(1.0);
}
```

### DPI Scaling

Electron/Chromium handles DPI scaling automatically. CSS pixels are logical pixels — at 200% scaling, a CSS `4px` value renders as 8 physical pixels. No special code is needed, but verification is required.

Key verification points:
- **Resize handle (6px)**: Must remain grabbable. At 100% DPI = 6px physical. At 200% DPI = 12px physical. Both are adequate hit targets.
- **Accent line (2px)**: Renders as 1 physical pixel at 100% DPI and 4 physical pixels at 200%. Visible at all levels.
- **4px grid**: Scales cleanly at 125% (5px), 150% (6px), 200% (8px).

### Focus Trap Pattern for Onboarding Overlay

```typescript
// Focus trap implementation pattern
function trapFocus(containerRef: RefObject<HTMLElement>) {
  const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    
    const focusable = containerRef.current?.querySelectorAll(focusableSelector);
    if (!focusable?.length) return;
    
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  
  containerRef.current?.addEventListener('keydown', handleKeyDown);
}
```

### System Color Keywords Reference

For `@media (forced-colors: active)`:
| Keyword | Meaning |
|---------|---------|
| `Canvas` | Background color |
| `CanvasText` | Text color |
| `Highlight` | Selected/focused item background |
| `HighlightText` | Selected/focused item text |
| `GrayText` | Disabled text |
| `ButtonBorder` | Border color |
| `LinkText` | Hyperlink color |

### Testing Standards

- Unit tests with Vitest for constructor options and CSS validation
- Component tests with `@testing-library/preact` for ARIA attributes and focus trap
- Main process tests with mocked `nativeTheme` for high contrast and reduced motion detection
- Manual testing required for:
  - Screen reader verification (Narrator, NVDA)
  - DPI scaling at 100%, 125%, 150%, 200%
  - High contrast mode visual verification
  - Reduced motion behavior (toggle in Windows Settings > Accessibility > Visual effects)

### Project Structure Notes

| Action | File Path | Notes |
|--------|-----------|-------|
| MODIFY | `src/renderer/global.css` | Add `@media (prefers-reduced-motion: reduce)` and `@media (forced-colors: active)` rules |
| MODIFY | `src/renderer/components/Terminal/TerminalView.tsx` | Add `screenReaderMode: true` to Terminal constructor, add reduced-motion media query listener |
| MODIFY | `src/main/window-manager.ts` | Detect reduced motion for slide animation, detect high contrast for opacity override, listen to `nativeTheme.on('updated')` |
| MODIFY | `src/renderer/components/Onboarding/OnboardingOverlay.tsx` | Verify/add `role="dialog"`, `aria-modal="true"`, `aria-label`, focus trap |
| MODIFY | `src/shared/channels.ts` | Add `accessibility:reduced-motion` and `accessibility:high-contrast` IPC channels if needed |
| MODIFY | `src/preload/index.ts` | Expose accessibility preference methods if needed |
| CREATE | `src/renderer/components/Terminal/TerminalView.test.tsx` | Tests for screenReaderMode option |
| CREATE | `src/renderer/components/Onboarding/OnboardingOverlay.test.tsx` | Tests for ARIA attributes and focus trap |

### References

- **UX Design Specification**: `docs/planning-artifacts/ux-design-specification.md` — UX-DR23 (screen reader support), UX-DR24 (high contrast), UX-DR25 (reduced motion), UX-DR28 (DPI verification)
- **Architecture**: `docs/planning-artifacts/architecture.md` — Electron nativeTheme API, main/renderer IPC patterns
- **Epics & Stories**: `docs/planning-artifacts/epics.md` — Epic 5, Story 5.4
- **PRD**: `docs/planning-artifacts/prd.md` — NFR15 (crash rate — accessibility features must not impact stability), NFR21 (keyboard accessible)
- **xterm.js docs**: Terminal constructor options — `screenReaderMode` property
- **MDN**: `@media (forced-colors: active)`, `@media (prefers-reduced-motion: reduce)`, system color keywords
- **Dependencies**:
  - Story 5.1 (CSS custom properties in `global.css` — high contrast overrides these tokens)
  - Story 5.2 (resize handle — must remain grabbable at all DPI levels)
  - Story 5.3 (focus management — focus indicators must be visible in high contrast)
  - Epic 1 Story 1.3 (xterm.js Terminal instance in `TerminalView.tsx`)
  - Epic 1 Story 1.4 (slide animation in `window-manager.ts` — reduced motion disables it)
  - Epic 2 Story 2.2 (opacity control — high contrast overrides to 100%)
  - Epic 4 Story 4.1 (onboarding overlay — ARIA attributes and focus trap)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
