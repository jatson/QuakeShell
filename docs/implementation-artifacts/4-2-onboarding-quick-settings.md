# Story 4.2: Onboarding Quick Settings

Status: done

## Story

As a new user,
I want to configure essential settings during the first-run experience,
So that QuakeShell is personalized to my needs before I start using it.

## Acceptance Criteria

1. **Given** the onboarding overlay card **When** the quick settings section renders **Then** three Settings Row sub-components are displayed: Shell selector, Opacity slider, and Focus-fade toggle **And** each Settings Row is a flex row with label left / value right, `--bg-chrome` background, 1px `--border`, 8px 12px padding, 6px border-radius

2. **Given** the Shell selector setting row **When** the user interacts with it **Then** it offers at minimum "PowerShell" and "WSL" options (WSL only shown if WSL is detected on the system)

3. **Given** the Opacity slider setting row **When** the user drags the slider **Then** the terminal opacity changes in real-time behind the overlay, providing live preview of the selected value

4. **Given** the Focus-fade toggle setting row **When** the user toggles it **Then** the value updates to on/off (default: on)

5. **Given** the user adjusts settings and then dismisses the overlay (via CTA, hotkey, or Escape) **When** the dismissal occurs **Then** all adjusted settings are saved to `config.json` via the config-store **And** `firstRun` is set to `false` in the config **And** the settings take effect immediately (opacity already previewed, shell and focus-fade active)

6. **Given** the app crashes or is force-killed during the onboarding overlay **When** the app is relaunched **Then** `firstRun` is still `true` (it was not set to `false` before dismissal) and the onboarding overlay shows again

7. **Given** `firstRun` is `false` in the config **When** the app starts **Then** the onboarding overlay is never shown — the terminal starts normally, hidden and waiting for the hotkey

8. **Given** the entire onboarding flow (launch → overlay → adjust settings → dismiss → terminal ready) **When** timed from app start to first usable terminal **Then** the flow completes in <30 seconds for a user who accepts defaults and clicks the CTA (NFR20)

## Tasks / Subtasks

- [ ] Task 1: Create SettingsRow sub-component (AC: #1)
  - [ ] 1.1: Create `src/renderer/components/Onboarding/SettingsRow.tsx` as a default-export Preact component accepting props: `label: string`, `children: ComponentChildren` (value/control slot)
  - [ ] 1.2: Render a flex row container with label on the left and children (control) on the right
  - [ ] 1.3: Style with `--bg-chrome` background, 1px `--border` border, 8px 12px padding, 6px border-radius
  - [ ] 1.4: Create `src/renderer/components/Onboarding/SettingsRow.module.css` with flex layout and design token styles
  - [ ] 1.5: Ensure consistent label styling: `--fg-primary` color, 14px font size

- [ ] Task 2: Create ShellSelector sub-component (AC: #2)
  - [ ] 2.1: Create `src/renderer/components/Onboarding/ShellSelector.tsx` as a default-export Preact component
  - [ ] 2.2: Accept props: `value: string` (current shell), `onChange: (shell: string) => void`, `wslAvailable: boolean`
  - [ ] 2.3: Render a `<select>` or segmented button group with "PowerShell" option always present
  - [ ] 2.4: Conditionally render "WSL" option only if `wslAvailable` prop is `true`
  - [ ] 2.5: Style the selector with `--bg-chrome` background, `--fg-primary` text, `--border` border, matching the onboarding design language
  - [ ] 2.6: Create `src/renderer/components/Onboarding/ShellSelector.module.css` for selector styles

- [ ] Task 3: Implement WSL detection IPC (AC: #2)
  - [ ] 3.1: Add `APP_CHECK_WSL` channel constant to `src/shared/channels.ts`
  - [ ] 3.2: In `src/main/ipc-handlers.ts`, register a handler for `APP_CHECK_WSL` that spawns `wsl.exe --list --quiet` and returns `true` if the command succeeds with output, `false` if it fails or produces no output
  - [ ] 3.3: Wrap the spawn in a try/catch — return `false` on any error (WSL not installed, command not found)
  - [ ] 3.4: In `src/preload/index.ts`, expose `quakeshell.app.checkWSL(): Promise<boolean>` in the contextBridge
  - [ ] 3.5: Add type definition for `checkWSL` to the preload API types in `src/shared/ipc-types.ts`

- [ ] Task 4: Create OpacitySlider sub-component (AC: #3)
  - [ ] 4.1: Create `src/renderer/components/Onboarding/OpacitySlider.tsx` as a default-export Preact component
  - [ ] 4.2: Accept props: `value: number` (0.0–1.0), `onChange: (value: number) => void`
  - [ ] 4.3: Render an `<input type="range">` with min=0.3, max=1.0, step=0.05 (sensible range — below 0.3 is unusable)
  - [ ] 4.4: Display the current value as a percentage label next to the slider (e.g., "85%")
  - [ ] 4.5: On `input` event (not just `change`), call `onChange` to enable real-time preview as the user drags
  - [ ] 4.6: Style the range slider with `--accent` for the track fill, `--bg-chrome` for the track background, custom thumb styling
  - [ ] 4.7: Create `src/renderer/components/Onboarding/OpacitySlider.module.css` for slider styles

- [ ] Task 5: Wire live opacity preview (AC: #3)
  - [ ] 5.1: In OnboardingOverlay, when the opacity slider value changes, immediately call `window.quakeshell.config.set('opacity', value)` to update the config
  - [ ] 5.2: The main process config-store hot-reload (from Story 2.1) picks up the change and applies it to the BrowserWindow via `win.setOpacity(value)` — this creates the live preview behind the overlay
  - [ ] 5.3: Store the original opacity value on overlay mount so it can be restored if the user cancels (though current design has no cancel — all dismissals save)

- [ ] Task 6: Create FocusFadeToggle sub-component (AC: #4)
  - [ ] 6.1: Create a toggle control within the SettingsRow for focus-fade — this can be a simple `<button>` that toggles between "On" and "Off" states
  - [ ] 6.2: Accept props: `value: boolean`, `onChange: (value: boolean) => void`
  - [ ] 6.3: Style the toggle with `--accent` background when on, `--bg-chrome` when off, smooth transition, `--fg-primary` text
  - [ ] 6.4: Display "On" or "Off" text label reflecting current state
  - [ ] 6.5: Implement as a simple inline component within `OnboardingOverlay.tsx` or as a separate file if complexity warrants it

- [ ] Task 7: Integrate settings into OnboardingOverlay (AC: #1, #2, #3, #4, #5)
  - [ ] 7.1: In `OnboardingOverlay.tsx`, add local signals (or `useState`) for: `shellSelection`, `opacityValue`, `focusFadeEnabled`
  - [ ] 7.2: Initialize these values from the current config via the ConfigStore signals on component mount
  - [ ] 7.3: Call `window.quakeshell.app.checkWSL()` on mount and store the result in a `wslAvailable` signal
  - [ ] 7.4: Render three `<SettingsRow>` components in the card between the hotkey display and the CTA button:
    - Shell: `<SettingsRow label="Shell"><ShellSelector ... /></SettingsRow>`
    - Opacity: `<SettingsRow label="Opacity"><OpacitySlider ... /></SettingsRow>`
    - Focus Fade: `<SettingsRow label="Focus Fade"><FocusFadeToggle ... /></SettingsRow>`
  - [ ] 7.5: Add vertical spacing (gap or margin) between each SettingsRow (e.g., 8px gap)

- [ ] Task 8: Implement settings persistence on dismissal (AC: #5, #6, #7)
  - [ ] 8.1: Update the `dismiss()` handler from Story 4.1 to save all current settings values before setting `firstRun` to `false`
  - [ ] 8.2: Batch the config writes: `window.quakeshell.config.set('shell', shellSelection)`, `window.quakeshell.config.set('opacity', opacityValue)`, `window.quakeshell.config.set('focusFade', focusFadeEnabled)`, then `window.quakeshell.config.set('firstRun', false)`
  - [ ] 8.3: Ensure `firstRun` is set to `false` as the LAST write — this is the atomic gate. If the app crashes before this write, `firstRun` remains `true` and the overlay will show again on next launch (AC #6)
  - [ ] 8.4: Opacity is already live-previewed (Task 5), shell selection and focus-fade take effect immediately via config hot-reload after persistence
  - [ ] 8.5: After all settings are saved and `firstRun` is set to `false`, focus the terminal (xterm.js instance)

- [ ] Task 9: Verify normal startup when firstRun is false (AC: #7)
  - [ ] 9.1: Confirm that when `firstRun` is `false` in config, `OnboardingOverlay` returns `null` and the terminal starts normally (hidden, waiting for hotkey)
  - [ ] 9.2: Confirm the auto-show logic from Story 4.1 Task 6 is guarded by `firstRun === true` — normal startup does not auto-show

- [ ] Task 10: Performance validation (AC: #8)
  - [ ] 10.1: Measure the time from `app.ready` event to overlay render (target: <500ms)
  - [ ] 10.2: Measure the time from CTA click to terminal cursor active (target: <100ms)
  - [ ] 10.3: The full flow (launch → overlay → click CTA → terminal ready) must complete in <30 seconds for a user who accepts defaults — given the overlay renders quickly and dismissal is a single click, this is primarily constrained by app startup time
  - [ ] 10.4: Ensure the WSL detection (`wsl.exe --list --quiet`) does not block the overlay render — run it asynchronously and update the Shell selector when the result arrives

- [ ] Task 11: Unit and integration testing (AC: #1–#8)
  - [ ] 11.1: Create/extend `src/renderer/components/Onboarding/OnboardingOverlay.test.tsx`:
    - Test three SettingsRow components render inside the overlay
    - Test Shell selector shows "PowerShell" when WSL is not available
    - Test Shell selector shows "PowerShell" and "WSL" when WSL is available
    - Test Opacity slider triggers live preview (calls config.set on input)
    - Test Focus-fade toggle alternates between on/off states
    - Test dismissal saves all settings values plus `firstRun: false`
    - Test `firstRun` is set to `false` LAST in the dismissal sequence
  - [ ] 11.2: Create `src/renderer/components/Onboarding/SettingsRow.test.tsx`:
    - Test renders label and children
    - Test correct CSS classes applied
  - [ ] 11.3: Create `src/renderer/components/Onboarding/ShellSelector.test.tsx`:
    - Test renders "PowerShell" option
    - Test conditionally renders "WSL" option based on `wslAvailable` prop
    - Test calls `onChange` when selection changes
  - [ ] 11.4: Create `src/renderer/components/Onboarding/OpacitySlider.test.tsx`:
    - Test renders range input with correct min/max/step
    - Test displays current value as percentage label
    - Test calls `onChange` on input event (not just change)
  - [ ] 11.5: Test WSL detection IPC:
    - Test `APP_CHECK_WSL` handler returns `true` when WSL is available
    - Test `APP_CHECK_WSL` handler returns `false` when WSL is not available
    - Test `APP_CHECK_WSL` handler returns `false` on error (command not found)

## Dev Notes

### Architecture Patterns

- **Preact components with default export**: All new components follow the project convention of `export default function ComponentName()`.
- **CSS Modules**: Each sub-component gets a co-located `.module.css` file. Styles use design tokens from `global.css`.
- **Signals for local state**: Use `useSignal()` from `@preact/signals` for local component state (shell selection, opacity value, focus-fade toggle, WSL availability). Read config values from the ConfigStore signals layer.
- **No direct IPC from components**: Config reads go through the ConfigStore signals sync-layer. Config writes use `window.quakeshell.config.set()`. WSL detection uses the exposed `window.quakeshell.app.checkWSL()`.
- **Atomic dismissal gate**: The `firstRun` flag is set to `false` as the very last operation in the dismissal flow. All other settings are written first. This ensures that if the app crashes during onboarding, `firstRun` remains `true` and the overlay will show again.
- **Live preview for opacity**: The opacity slider writes to config on every `input` event (not just `change`). The main process config hot-reload from Story 2.1 picks up the change and applies it to the BrowserWindow, creating a real-time preview behind the overlay backdrop.
- **Async WSL detection**: The WSL check runs asynchronously on overlay mount. The Shell selector initially shows only "PowerShell" and adds "WSL" option when the async check resolves with `true`. This prevents blocking the overlay render.

### Design Token Values

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-terminal` | `#1a1b26` | Card background (from Story 4.1) |
| `--bg-chrome` | `#13141c` | SettingsRow background, KeyCap background, slider track |
| `--fg-primary` | `#c0caf5` | Labels, text |
| `--fg-dimmed` | `#565f89` | Subtitle, secondary text |
| `--accent` | `#7aa2f7` | Slider fill, toggle active state, CTA button |
| `--border` | `#2a2b3d` | SettingsRow border, input borders |
| `--black-bright` | `#414868` | KeyCap depth shadow |

### Component Specifications

```
SettingsRow:
  display: flex
  align-items: center
  justify-content: space-between
  background: var(--bg-chrome)
  border: 1px solid var(--border)
  padding: 8px 12px
  border-radius: 6px
  gap: 12px

ShellSelector (<select> or segmented control):
  background: var(--bg-chrome)
  color: var(--fg-primary)
  border: 1px solid var(--border)
  border-radius: 4px
  padding: 4px 8px
  font-size: 14px

OpacitySlider (<input type="range">):
  width: ~140px
  accent-color: var(--accent)  (or custom thumb/track styling)
  min: 0.3, max: 1.0, step: 0.05

FocusFadeToggle:
  display: inline-flex
  background: var(--accent) when on, var(--bg-chrome) when off
  border-radius: 12px (pill shape)
  padding: 4px 12px
  transition: background 150ms ease
  cursor: pointer
```

### WSL Detection Flow

```
OnboardingOverlay mounts
  → useEffect: window.quakeshell.app.checkWSL()
    → IPC → main process handler
      → child_process.execSync('wsl.exe --list --quiet')
        → Success with output → return true
        → Error / no output → return false
    → IPC response → update wslAvailable signal
    → ShellSelector re-renders with/without WSL option
```

### Settings Persistence Sequence (on dismiss)

```
User clicks CTA / presses Escape / presses hotkey
  → dismiss() handler:
    1. window.quakeshell.config.set('shell', shellSelection)
    2. window.quakeshell.config.set('opacity', opacityValue)
    3. window.quakeshell.config.set('focusFade', focusFadeEnabled)
    4. window.quakeshell.config.set('firstRun', false)  ← LAST (atomic gate)
    5. Focus terminal (xterm.js)
    6. Hide overlay (set local signal to false)
```

### Dependencies on Previous Epics

| Module | Epic/Story | Usage in this story |
|--------|------------|---------------------|
| `src/main/config-store.ts` | 1.2 | Reads/writes all settings, persists to `config.json` |
| `src/main/window-manager.ts` | 1.4 | Opacity control via `win.setOpacity()` |
| `src/main/ipc-handlers.ts` | 1.2 | Register `APP_CHECK_WSL` handler |
| `src/renderer/state/config-store.ts` | 2.1 | ConfigStore signals — read initial values, react to changes |
| `src/renderer/components/App.tsx` | 1.3 | Root component hosting OnboardingOverlay |
| `src/shared/config-schema.ts` | 1.2 | Zod schema: `firstRun`, `opacity`, `shell`, `focusFade` fields |
| `src/shared/channels.ts` | 1.2 | IPC channel constants — add `APP_CHECK_WSL` |
| `src/preload/index.ts` | 1.1 | contextBridge — add `quakeshell.app.checkWSL()` |
| Story 2.1 config hot-reload | 2.1 | Live opacity preview works via config change → hot-reload → window update |
| Story 2.2 opacity control | 2.2 | Opacity slider leverages the existing opacity control pipeline |
| Story 2.4 shell selection | 2.4 | Shell selector leverages the existing shell selection mechanism |
| Story 4.1 overlay | 4.1 | This story extends the overlay from 4.1 with settings UI |

### Testing Standards

- **Framework**: Vitest 4.1.2
- **Co-located tests**: Test files live next to source files in `src/renderer/components/Onboarding/`
- **Rendering**: Use Preact Testing Library (`@testing-library/preact`) for component rendering, querying, and user event simulation
- **Mocking**: Mock `window.quakeshell.config.set()`, `window.quakeshell.config.getAll()`, `window.quakeshell.app.checkWSL()`, ConfigStore signals
- **User events**: Use `@testing-library/user-event` for simulating slider drags, button clicks, select changes, toggle clicks
- **Coverage targets**: All settings render correctly, WSL conditional rendering, live opacity preview calls, dismissal saves all values in correct order, crash resilience (firstRun gate)

### Project Structure Notes

Files to **create**:
```
src/
  renderer/
    components/
      Onboarding/
        SettingsRow.tsx                  # Settings row sub-component (default export)
        SettingsRow.module.css           # Settings row styles
        SettingsRow.test.tsx             # Unit tests for SettingsRow
        ShellSelector.tsx                # Shell selector sub-component (default export)
        ShellSelector.module.css         # Shell selector styles
        ShellSelector.test.tsx           # Unit tests for ShellSelector
        OpacitySlider.tsx                # Opacity slider sub-component (default export)
        OpacitySlider.module.css         # Opacity slider styles
        OpacitySlider.test.tsx           # Unit tests for OpacitySlider
```

Files to **modify**:
```
src/
  renderer/
    components/
      Onboarding/
        OnboardingOverlay.tsx            # Add settings section with 3 SettingsRow components
        OnboardingOverlay.module.css     # Add settings section styling
        OnboardingOverlay.test.tsx       # Add tests for settings integration
  main/
    ipc-handlers.ts                      # Register APP_CHECK_WSL handler
  shared/
    channels.ts                          # Add APP_CHECK_WSL channel constant
    ipc-types.ts                         # Add checkWSL type to preload API types
  preload/
    index.ts                             # Expose quakeshell.app.checkWSL()
```

### References

- Architecture: [`architecture.md`](docs/planning-artifacts/architecture.md) — Renderer component patterns, IPC flow, CSS Modules, preload API
- PRD: [`prd.md`](docs/planning-artifacts/prd.md) — FR35 (first-run onboarding), FR37 (quick settings), NFR20 (<30s install-to-toggle)
- Epics: [`epics.md`](docs/planning-artifacts/epics.md) — Epic 4, Story 4.2
- UX Design: [`ux-design-specification.md`](docs/planning-artifacts/ux-design-specification.md) — UX-DR11 (Onboarding Overlay), UX-DR13 (Settings Row), design token values
- Story 1.2 (dependency): [`1-2-configuration-system-with-schema-validation.md`](docs/implementation-artifacts/1-2-configuration-system-with-schema-validation.md) — Config store, Zod schema with `firstRun`, `opacity`, `shell`, `focusFade`
- Story 2.1 (dependency): [`2-1-config-hot-reload-and-live-settings.md`](docs/implementation-artifacts/2-1-config-hot-reload-and-live-settings.md) — Config hot-reload enabling live opacity preview
- Story 2.2 (dependency): [`2-2-opacity-control-and-focus-fade.md`](docs/implementation-artifacts/2-2-opacity-control-and-focus-fade.md) — Opacity pipeline reused by slider
- Story 2.4 (dependency): [`2-4-shell-selection-and-animation-speed.md`](docs/implementation-artifacts/2-4-shell-selection-and-animation-speed.md) — Shell selection mechanism reused by selector
- Story 3.2 (dependency): [`3-2-wsl-shell-support.md`](docs/implementation-artifacts/3-2-wsl-shell-support.md) — WSL shell support, detection patterns
- Story 4.1 (dependency): [`4-1-onboarding-overlay-with-hotkey-teaching.md`](docs/implementation-artifacts/4-1-onboarding-overlay-with-hotkey-teaching.md) — Overlay component this story extends

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
