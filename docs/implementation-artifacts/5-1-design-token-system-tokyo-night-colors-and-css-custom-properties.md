# Story 5.1: Design Token System — Tokyo Night Colors and CSS Custom Properties

Status: ready-for-dev

## Story

As a developer,
I want a cohesive visual identity with design tokens defined as CSS custom properties,
so that the terminal looks polished and professional with consistent theming across all UI surfaces.

## Acceptance Criteria

### AC 1: CSS Custom Properties Defined in `:root`
**Given** the `src/renderer/global.css` file
**When** CSS custom properties are defined in the `:root` block
**Then** the following color tokens are available:
- `--bg-terminal: #1a1b26`
- `--bg-chrome: #13141c`
- `--fg-primary: #c0caf5`
- `--fg-dimmed: #565f89`
- `--accent: #7aa2f7`
- `--border: #2a2b3d`
- `--red: #f7768e`
- `--green: #9ece6a`
- `--yellow: #e0af68`
- `--blue: #7aa2f7`
- `--magenta: #bb9af7`
- `--cyan: #7dcfff`
- `--black: #15161e`
- `--black-bright: #414868`
- `--white: #a9b1d6`
- `--white-bright: #c0caf5`

### AC 2: xterm.js Tokyo Night ITheme
**Given** the xterm.js Terminal instance
**When** it initializes with the ITheme configuration
**Then** the Tokyo Night color scheme is applied:
- background `#1a1b26`
- foreground `#c0caf5`
- cursor `#7aa2f7`
- selection `#283457`
- Full ANSI-16 palette:
  - black `#15161e` / bright `#414868`
  - red `#f7768e` / bright `#f7768e`
  - green `#9ece6a` / bright `#9ece6a`
  - yellow `#e0af68` / bright `#e0af68`
  - blue `#7aa2f7` / bright `#7aa2f7`
  - magenta `#bb9af7` / bright `#bb9af7`
  - cyan `#7dcfff` / bright `#7dcfff`
  - white `#a9b1d6` / bright `#c0caf5`

### AC 3: Accent Line at Bottom Edge
**Given** the terminal window
**When** it renders
**Then** a 2px accent-colored (`#7aa2f7`) line is visible at the bottom edge of the drop-down panel, providing clean visual termination

### AC 4: Chrome Typography
**Given** non-terminal chrome elements (onboarding overlay, future settings panel)
**When** they render text
**Then** they use the Segoe UI system font stack (`Segoe UI, -apple-system, sans-serif`) with appropriate sizes:
- Labels at 13px
- Headings at 18px semibold

### AC 5: CSS Modules Reference Global Custom Properties
**Given** the CSS custom properties
**When** a Preact component uses CSS Modules (`.module.css`)
**Then** component styles reference the global custom properties (e.g., `color: var(--fg-primary)`) for consistent theming

## Tasks / Subtasks

- [ ] Task 1: Define CSS custom properties in `:root` block (AC: #1)
  - [ ] 1.1 Open `src/renderer/global.css` and locate or create the `:root` block
  - [ ] 1.2 Add all 16 color tokens (`--bg-terminal`, `--bg-chrome`, `--fg-primary`, `--fg-dimmed`, `--accent`, `--border`, `--red`, `--green`, `--yellow`, `--blue`, `--magenta`, `--cyan`, `--black`, `--black-bright`, `--white`, `--white-bright`)
  - [ ] 1.3 Add spacing tokens based on 4px grid (`--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`, `--space-6: 24px`, `--space-8: 32px`, `--space-12: 48px`)
  - [ ] 1.4 Add typography tokens (`--font-mono: 'Cascadia Code', Consolas, 'Courier New', monospace`, `--font-ui: 'Segoe UI', -apple-system, sans-serif`, `--font-size-label: 13px`, `--font-size-heading: 18px`)

- [ ] Task 2: Create xterm.js Tokyo Night ITheme object (AC: #2)
  - [ ] 2.1 Create a theme constants file at `src/renderer/theme/tokyo-night.ts` exporting the ITheme object
  - [ ] 2.2 Define all ITheme properties: `background`, `foreground`, `cursor`, `cursorAccent`, `selectionBackground`, and full ANSI-16 color palette (`black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, and their bright variants)
  - [ ] 2.3 Update `src/renderer/components/Terminal/TerminalView.tsx` to import and apply the Tokyo Night theme at Terminal instantiation via the `theme` option
  - [ ] 2.4 Remove any hardcoded color values from `TerminalView.tsx` that are now covered by the theme

- [ ] Task 3: Add 2px accent line at the bottom edge (AC: #3)
  - [ ] 3.1 Add a CSS rule for the terminal container's bottom border or `::after` pseudo-element: `border-bottom: 2px solid var(--accent)` or equivalent
  - [ ] 3.2 Ensure the accent line is positioned at the very bottom of the drop-down panel (below content, above resize handle if present)

- [ ] Task 4: Apply chrome typography styles (AC: #4)
  - [ ] 4.1 Add global CSS rules for non-terminal UI body text using `var(--font-ui)`
  - [ ] 4.2 Define utility classes or CSS custom properties for label sizing (13px) and heading sizing (18px semibold)
  - [ ] 4.3 Verify the onboarding overlay (`OnboardingOverlay.tsx`) uses the system font tokens — update its CSS Module if needed com references to `var(--font-ui)`, `var(--font-size-label)`, `var(--font-size-heading)`

- [ ] Task 5: Migrate existing component styles to use CSS custom properties (AC: #5)
  - [ ] 5.1 Audit all existing `.module.css` files for hardcoded color values
  - [ ] 5.2 Replace hardcoded colors with `var(--token-name)` references
  - [ ] 5.3 Verify OnboardingOverlay styles reference global custom properties

- [ ] Task 6: Write tests (AC: #1, #2, #3, #4, #5)
  - [ ] 6.1 Write unit test for `tokyo-night.ts` verifying all ITheme color values match the spec
  - [ ] 6.2 Write snapshot/render test for TerminalView confirming theme is applied
  - [ ] 6.3 Write a CSS token validation test (or manual checklist) verifying all 16 color tokens exist in `:root`
  - [ ] 6.4 Verify accent line renders at the bottom edge via component test or visual inspection

## Dev Notes

### Design Token Architecture

The design token system establishes a single source of truth for QuakeShell's visual identity. Tokens are defined in two layers:

1. **CSS Custom Properties** in `global.css` `:root` — consumed by all CSS Modules and global styles
2. **TypeScript ITheme constant** in `tokyo-night.ts` — consumed by xterm.js Terminal constructor

These two layers must stay synchronized. The xterm.js theme uses the same hex values but via a TypeScript object (xterm.js does not read CSS custom properties).

### xterm.js ITheme API

The `ITheme` interface from `@xterm/xterm` accepts:

```typescript
const tokyoNightTheme: ITheme = {
  background: '#1a1b26',
  foreground: '#c0caf5',
  cursor: '#7aa2f7',
  cursorAccent: '#1a1b26',
  selectionBackground: '#283457',
  selectionForeground: undefined, // use default
  black: '#15161e',
  brightBlack: '#414868',
  red: '#f7768e',
  brightRed: '#f7768e',
  green: '#9ece6a',
  brightGreen: '#9ece6a',
  yellow: '#e0af68',
  brightYellow: '#e0af68',
  blue: '#7aa2f7',
  brightBlue: '#7aa2f7',
  magenta: '#bb9af7',
  brightMagenta: '#bb9af7',
  cyan: '#7dcfff',
  brightCyan: '#7dcfff',
  white: '#a9b1d6',
  brightWhite: '#c0caf5',
};
```

Pass this as `{ theme: tokyoNightTheme }` in the Terminal constructor options.

### Accent Line Implementation

The 2px accent line at the bottom of the terminal panel can be implemented as:
- A `border-bottom: 2px solid var(--accent)` on the terminal's outermost container div
- Or a `::after` pseudo-element on the terminal wrapper

This line should appear between the terminal content and the resize handle (Story 5.2).

### Typography Stack

- **Terminal font**: `'Cascadia Code', Consolas, 'Courier New', monospace` at 14px — set via xterm.js `fontFamily` and `fontSize` options
- **Chrome UI font**: `'Segoe UI', -apple-system, sans-serif` — set via CSS custom property `--font-ui`

### Spacing Grid

The 4px base grid system defines spacing tokens: 4, 8, 12, 16, 24, 32, 48px. These scale cleanly at common Windows DPI levels (125%, 150%, 200%).

### Testing Standards

- Unit tests with Vitest for the theme constant file
- Component render tests to confirm theme application
- CSS validation can be done via snapshot testing of rendered output
- Visual verification of accent line and typography at standard DPI

### Project Structure Notes

| Action | File Path | Notes |
|--------|-----------|-------|
| MODIFY | `src/renderer/global.css` | Add `:root` block with all CSS custom property tokens, typography tokens, spacing tokens |
| CREATE | `src/renderer/theme/tokyo-night.ts` | Export `tokyoNightTheme: ITheme` constant |
| MODIFY | `src/renderer/components/Terminal/TerminalView.tsx` | Import and apply `tokyoNightTheme` in Terminal constructor |
| MODIFY | `src/renderer/components/Onboarding/OnboardingOverlay.module.css` | Replace hardcoded colors with `var()` references |
| CREATE | `src/renderer/theme/tokyo-night.test.ts` | Unit tests for theme constant |

### References

- **UX Design Specification**: `docs/planning-artifacts/ux-design-specification.md` — UX-DR1 (Tokyo Night palette), UX-DR2 (token naming), UX-DR3 (spacing grid)
- **Architecture**: `docs/planning-artifacts/architecture.md` — Renderer process patterns, CSS Modules convention
- **Epics & Stories**: `docs/planning-artifacts/epics.md` — Epic 5, Story 5.1
- **PRD**: `docs/planning-artifacts/prd.md` — NFR visual design requirements
- **Dependencies**: Epic 1 (xterm.js Terminal setup in `TerminalView.tsx`), Epic 4 (OnboardingOverlay component)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
