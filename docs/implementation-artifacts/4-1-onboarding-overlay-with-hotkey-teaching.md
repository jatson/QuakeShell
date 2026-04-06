# Story 4.1: Onboarding Overlay with Hotkey Teaching

Status: done

## Story

As a new user,
I want a first-run overlay that teaches me the hotkey with a visual key cap display and lets me dismiss it easily,
So that I learn the core interaction in seconds and can start using QuakeShell immediately.

## Acceptance Criteria

1. **Given** the `firstRun` config value is `true` (default on fresh install) **When** the app launches **Then** the terminal auto-shows at the configured `dropHeight` (default 30%) and the onboarding overlay is displayed on top of the terminal

2. **Given** the onboarding overlay is displayed **When** it renders **Then** it shows a backdrop of `rgba(0,0,0,0.7)` with `backdrop-filter: blur(4px)` covering the terminal **And** a centered card (max-width 480px, `--bg-terminal` background, 12px border-radius, 40px padding) containing the onboarding content

3. **Given** the onboarding card **When** the hotkey section renders **Then** the configured hotkey (default `Ctrl+Shift+Q`) is displayed using Key Cap sub-components — each key rendered as a rounded rect with `--bg-chrome` background, 1px `--border`, 3px bottom `--black-bright` depth shadow, Cascadia Code 16px font, 8px 14px padding, 6px border-radius **And** keys are separated by `+` characters between the caps

4. **Given** the onboarding card **When** the call-to-action section renders **Then** a primary CTA button labeled "Start Using QuakeShell" is displayed **And** a subtitle reads "change anytime from ⚙ or tray"

5. **Given** the onboarding overlay **When** the user clicks the "Start Using QuakeShell" CTA button **Then** the overlay is dismissed permanently and the terminal cursor is active and ready for input

6. **Given** the onboarding overlay **When** the user presses the configured hotkey (e.g., `Ctrl+Shift+Q`) **Then** the overlay is dismissed — the hotkey works during onboarding, teaching through action

7. **Given** the onboarding overlay **When** the user presses Escape **Then** the overlay is dismissed — no trap states, always escapable

8. **Given** the overlay component **When** it renders **Then** it has `role="dialog"`, `aria-modal="true"`, and `aria-label="Welcome to QuakeShell"` for screen reader accessibility

## Tasks / Subtasks

- [ ] Task 1: Create OnboardingOverlay Preact component (AC: #1, #2, #8)
  - [ ] 1.1: Create `src/renderer/components/Onboarding/OnboardingOverlay.tsx` as a default-export Preact component
  - [ ] 1.2: Read `firstRun` signal from `src/renderer/state/config-store.ts` — if `false`, return `null` (render nothing)
  - [ ] 1.3: Render a full-screen backdrop `<div>` with `rgba(0,0,0,0.7)` background and `backdrop-filter: blur(4px)`
  - [ ] 1.4: Render a centered card `<div>` inside the backdrop with max-width 480px, `--bg-terminal` background, 12px border-radius, 40px padding
  - [ ] 1.5: Add ARIA attributes: `role="dialog"`, `aria-modal="true"`, `aria-label="Welcome to QuakeShell"` on the card element
  - [ ] 1.6: Create `src/renderer/components/Onboarding/OnboardingOverlay.module.css` with all overlay, backdrop, and card styles using design tokens

- [ ] Task 2: Create KeyCap sub-component (AC: #3)
  - [ ] 2.1: Create `src/renderer/components/Onboarding/KeyCap.tsx` as a default-export Preact component accepting a `label: string` prop
  - [ ] 2.2: Render a `<span>` styled as a rounded rect: `--bg-chrome` background, 1px `--border` border, 3px bottom `--black-bright` box-shadow for depth effect, `font-family: 'Cascadia Code', monospace`, `font-size: 16px`, `padding: 8px 14px`, `border-radius: 6px`
  - [ ] 2.3: Create `src/renderer/components/Onboarding/KeyCap.module.css` for KeyCap styles using design tokens

- [ ] Task 3: Render hotkey display in the overlay (AC: #3)
  - [ ] 3.1: Read the configured hotkey string from the config store signal (e.g., `"Ctrl+Shift+Q"`)
  - [ ] 3.2: Parse the hotkey string by splitting on `+` to get individual key names (e.g., `["Ctrl", "Shift", "Q"]`)
  - [ ] 3.3: Map each key name to a `<KeyCap label={key} />` component, interspersing `+` separator characters (`--fg-dimmed` color) between each KeyCap
  - [ ] 3.4: Wrap the hotkey display in a flex container with `align-items: center` and `gap: 8px`

- [ ] Task 4: Render CTA button and subtitle (AC: #4)
  - [ ] 4.1: Add a primary CTA `<button>` with text "Start Using QuakeShell" — styled with `--accent` background, `--bg-terminal` text color, 8px 24px padding, 6px border-radius, bold font, cursor pointer
  - [ ] 4.2: Add a subtitle `<p>` below the CTA with text "change anytime from ⚙ or tray" — styled with `--fg-dimmed` color, smaller font size
  - [ ] 4.3: Add hover/focus styles for the CTA button (slight brightness increase, focus outline for keyboard users)

- [ ] Task 5: Implement overlay dismissal logic (AC: #5, #6, #7)
  - [ ] 5.1: Create a `dismiss()` handler function in OnboardingOverlay that: sets `firstRun` to `false` via `window.quakeshell.config.set('firstRun', false)`, and hides the overlay by updating local component state
  - [ ] 5.2: Wire the CTA button's `onClick` to the `dismiss()` handler
  - [ ] 5.3: Add a `keydown` event listener (via `useEffect`) on the document that listens for the Escape key and calls `dismiss()`
  - [ ] 5.4: Ensure the hotkey (e.g., `Ctrl+Shift+Q`) also dismisses the overlay — the main process hotkey handler toggles the window, which should hide the overlay along with the terminal; alternatively, listen for the hotkey in the renderer and call `dismiss()` before the toggle hides the window
  - [ ] 5.5: On dismissal, ensure the terminal (xterm.js) receives focus so the cursor is active and ready for input
  - [ ] 5.6: Clean up the `keydown` event listener in the `useEffect` cleanup function

- [ ] Task 6: Auto-show terminal on first run (AC: #1)
  - [ ] 6.1: In `src/main/window-manager.ts` or `src/main/app-lifecycle.ts`, check `firstRun` config value during app startup
  - [ ] 6.2: If `firstRun` is `true`, call `windowManager.show()` (or equivalent) to auto-show the terminal at the configured `dropHeight` without waiting for the hotkey
  - [ ] 6.3: Ensure the onboarding overlay renders on top of the auto-shown terminal

- [ ] Task 7: Integrate OnboardingOverlay into App.tsx (AC: #1, #2)
  - [ ] 7.1: Import `OnboardingOverlay` in `src/renderer/components/App.tsx`
  - [ ] 7.2: Conditionally render `<OnboardingOverlay />` based on the `firstRun` config signal — the component itself also guards on `firstRun`, but the import should be present
  - [ ] 7.3: Position the overlay via CSS to layer on top of the terminal content (z-index above xterm.js container)

- [ ] Task 8: Unit and integration testing (AC: #1–#8)
  - [ ] 8.1: Create `src/renderer/components/Onboarding/OnboardingOverlay.test.tsx`:
    - Test that overlay renders when `firstRun` signal is `true`
    - Test that overlay does NOT render when `firstRun` signal is `false`
    - Test backdrop has correct styles (`rgba(0,0,0,0.7)`, `backdrop-filter: blur(4px)`)
    - Test card has correct ARIA attributes (`role="dialog"`, `aria-modal="true"`, `aria-label`)
    - Test hotkey display parses `"Ctrl+Shift+Q"` into 3 KeyCap components with `+` separators
    - Test CTA button text is "Start Using QuakeShell"
    - Test subtitle text is "change anytime from ⚙ or tray"
  - [ ] 8.2: Test dismissal behavior:
    - Test clicking CTA calls `window.quakeshell.config.set('firstRun', false)`
    - Test pressing Escape calls `dismiss()`
    - Test overlay disappears from DOM after dismissal
  - [ ] 8.3: Create `src/renderer/components/Onboarding/KeyCap.test.tsx`:
    - Test KeyCap renders the label text
    - Test KeyCap has correct CSS class applied
  - [ ] 8.4: Test auto-show on first run: verify `windowManager.show()` is called when `firstRun` is `true`

## Dev Notes

### Architecture Patterns

- **Preact component with default export**: All new components use `export default function ComponentName()` pattern, consistent with existing renderer components.
- **CSS Modules**: Each component gets a co-located `.module.css` file. Classes are imported as `import styles from './Component.module.css'` and applied via `className={styles.className}`.
- **Signals for state**: The `firstRun` value is read from the ConfigStore signals layer (`src/renderer/state/config-store.ts`). The component reactively hides when `firstRun` becomes `false`.
- **No direct IPC from components**: All config reads/writes go through the ConfigStore sync-layer which internally uses `window.quakeshell.config.set()` and `window.quakeshell.config.getAll()`. Components never call IPC directly.
- **Dismissal writes config**: When the overlay is dismissed, it sets `firstRun: false` via the config store. This write flows through IPC to the main process config-store, which persists to `config.json`. This is the atomic gate — if the app crashes before dismissal, `firstRun` remains `true` and the overlay shows again on next launch (see Story 4.2 AC #6).

### Design Token Values

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-terminal` | `#1a1b26` | Card background |
| `--bg-chrome` | `#13141c` | KeyCap background |
| `--fg-primary` | `#c0caf5` | Card text, KeyCap labels |
| `--fg-dimmed` | `#565f89` | Subtitle text, `+` separators |
| `--accent` | `#7aa2f7` | CTA button background |
| `--border` | `#2a2b3d` | Card border, KeyCap border |
| `--black-bright` | `#414868` | KeyCap depth shadow (3px bottom) |

### Component Specifications

```
Overlay Backdrop:
  background: rgba(0, 0, 0, 0.7)
  backdrop-filter: blur(4px)
  position: fixed; inset: 0
  z-index: 1000 (above xterm.js)
  display: flex; align-items: center; justify-content: center

Card:
  max-width: 480px
  background: var(--bg-terminal)
  border-radius: 12px
  padding: 40px
  border: 1px solid var(--border)

KeyCap:
  display: inline-flex
  background: var(--bg-chrome)
  border: 1px solid var(--border)
  box-shadow: 0 3px 0 var(--black-bright)
  font-family: 'Cascadia Code', monospace
  font-size: 16px
  padding: 8px 14px
  border-radius: 6px
  color: var(--fg-primary)

CTA Button:
  background: var(--accent)
  color: var(--bg-terminal)
  padding: 8px 24px
  border-radius: 6px
  font-weight: bold
  cursor: pointer
  border: none
```

### Accessibility Requirements

- Overlay root element: `role="dialog"`, `aria-modal="true"`, `aria-label="Welcome to QuakeShell"`
- CTA button must be focusable and reachable via Tab key
- Escape key dismisses the overlay (no trap states)
- Focus should be trapped inside the dialog while open (Tab cycles through interactive elements within the card)
- On dismissal, focus moves to the terminal (xterm.js instance)

### Hotkey Parsing Logic

```typescript
// Parse hotkey string "Ctrl+Shift+Q" into individual keys
const keys = hotkey.split('+'); // ["Ctrl", "Shift", "Q"]
// Render: <KeyCap label="Ctrl" /> + <KeyCap label="Shift" /> + <KeyCap label="Q" />
```

### Dependencies on Previous Epics

| Module | Epic | Usage in this story |
|--------|------|---------------------|
| `src/main/config-store.ts` | 1.2 | Reads/writes `firstRun` field, persists to `config.json` |
| `src/main/window-manager.ts` | 1.4 | Auto-show terminal on first run (`windowManager.show()`) |
| `src/renderer/state/config-store.ts` | 2.1 | ConfigStore signals sync-layer — reads `firstRun` signal |
| `src/renderer/components/App.tsx` | 1.3 | Root component — conditionally renders OnboardingOverlay |
| `src/shared/config-schema.ts` | 1.2 | Zod schema with `firstRun: z.boolean().default(true)` |
| `src/shared/channels.ts` | 1.2 | IPC channel constants for config operations |
| `src/preload/index.ts` | 1.1 | contextBridge with `quakeshell.config` namespace |

### Testing Standards

- **Framework**: Vitest 4.1.2
- **Co-located tests**: Test files live next to source files in `src/renderer/components/Onboarding/`
- **Mocking**: Mock `window.quakeshell.config.set()` and `window.quakeshell.config.getAll()`, mock the ConfigStore signals, mock `document.addEventListener` for keydown events
- **Rendering**: Use Preact Testing Library (`@testing-library/preact`) for component rendering and assertions
- **Coverage targets**: All render paths (firstRun true/false), all dismissal paths (CTA click, Escape, hotkey), ARIA attributes, KeyCap rendering, hotkey parsing

### Project Structure Notes

Files to **create**:
```
src/
  renderer/
    components/
      Onboarding/
        OnboardingOverlay.tsx            # Main overlay component (default export)
        OnboardingOverlay.module.css     # Overlay, backdrop, and card styles
        OnboardingOverlay.test.tsx       # Unit tests for overlay
        KeyCap.tsx                       # Key cap sub-component (default export)
        KeyCap.module.css                # Key cap styles
        KeyCap.test.tsx                  # Unit tests for KeyCap
```

Files to **modify**:
```
src/
  renderer/
    components/
      App.tsx                            # Import and render <OnboardingOverlay />
  main/
    window-manager.ts                    # Auto-show terminal when firstRun is true
    app-lifecycle.ts                     # (optional) Check firstRun on startup to trigger auto-show
```

### References

- Architecture: [`architecture.md`](docs/planning-artifacts/architecture.md) — Renderer component patterns, CSS Modules, Preact signals, IPC flow
- PRD: [`prd.md`](docs/planning-artifacts/prd.md) — FR35 (first-run onboarding), FR36 (hotkey teaching), NFR20 (<30s install-to-toggle)
- Epics: [`epics.md`](docs/planning-artifacts/epics.md) — Epic 4, Story 4.1
- UX Design: [`ux-design-specification.md`](docs/planning-artifacts/ux-design-specification.md) — UX-DR11 (Onboarding Overlay), UX-DR12 (Key Cap), design token values
- Story 1.2 (dependency): [`1-2-configuration-system-with-schema-validation.md`](docs/implementation-artifacts/1-2-configuration-system-with-schema-validation.md) — Config store, `firstRun` field in Zod schema
- Story 1.4 (dependency): [`1-4-window-management-toggle-animation-and-tray-icon.md`](docs/implementation-artifacts/1-4-window-management-toggle-animation-and-tray-icon.md) — Window manager show/toggle
- Story 2.1 (dependency): [`2-1-config-hot-reload-and-live-settings.md`](docs/implementation-artifacts/2-1-config-hot-reload-and-live-settings.md) — ConfigStore signals sync-layer in renderer

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
