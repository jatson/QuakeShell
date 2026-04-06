# Story P2-4.2: Dual-Channel Theme Apply (ThemeStyleInjector)

Status: review

## Story

As a user, I want theme changes to apply instantly to both the terminal colors and the UI chrome simultaneously, so that there is no flash of mis-themed content when I switch themes.

## Acceptance Criteria

- **AC1:** Given a `theme:changed` event with a new `ThemeDefinition` / When the renderer receives it / Then `ThemeStyleInjector` updates CSS custom properties on `:root` and calls `terminal.options.theme = xtermTheme` on every active xterm.js instance within a single microtask flush.
- **AC2:** Given the CSS custom properties update / When inspected in DevTools / Then `--bg-terminal`, `--bg-chrome`, `--fg-primary`, `--fg-dimmed`, `--accent`, `--border` all reflect the new theme's `chromeTokens` values.
- **AC3:** Given a terminal instance in a hidden background tab / When the theme changes / Then the theme is applied to that instance's `terminal.options.theme` so it renders correctly when next focused.
- **AC4:** Given a new tab is created after a theme change / When its xterm.js instance is initialized / Then it receives the current active theme's `xtermTheme` from the start (not the default Tokyo Night).

## Tasks / Subtasks

### Task 1: Create `ThemeStore` in renderer state
- [x] Create `src/renderer/state/theme-store.ts`
- [x] Import `signal` from `@preact/signals`
- [x] Import `ThemeDefinition` from `src/shared/ipc-types`
- [x] Import `Channels` from `src/shared/channels`
- [x] Declare module-level signal:
  ```typescript
  export const activeTheme = signal<ThemeDefinition | null>(null);
  ```
- [x] Implement `initThemeStore(): void`:
  - Call `window.electronAPI.on(Channels.THEME_CHANGED, (theme: ThemeDefinition) => { activeTheme.value = theme; })`
  - On init, also request the current theme: `window.electronAPI.invoke(Channels.THEME_LIST)` and set the initial `activeTheme.value` to the first item or the active one
  - Alternatively, receive initial theme via a dedicated `theme:get-active` channel — check if it exists in `channels.ts`, add if not
- [x] Implement `getCurrentTheme(): ThemeDefinition | null` — returns `activeTheme.peek()` (non-reactive read for initial terminal setup)
- [x] Export `{ activeTheme, initThemeStore, getCurrentTheme }`

### Task 2: Create `ThemeStyleInjector` component
- [x] Create `src/renderer/components/ThemeStyleInjector.tsx`
- [x] Import `useSignalEffect` from `@preact/signals`
- [x] Import `activeTheme` from `../state/theme-store`
- [x] Implement the component:
  ```tsx
  export default function ThemeStyleInjector() {
    useSignalEffect(() => {
      const theme = activeTheme.value;
      if (!theme) return;
      applyChromeCssVars(theme.chromeTokens);
    });
    return null; // renders no DOM
  }
  ```
- [x] Implement `applyChromeCssVars(tokens: ThemeDefinition['chromeTokens']): void`:
  - Use `document.documentElement.style.setProperty('--bg-terminal', tokens.bgTerminal)` etc.
  - Map all 6 token keys to their CSS custom property names:
    - `bgTerminal` → `--bg-terminal`
    - `bgChrome` → `--bg-chrome`
    - `fgPrimary` → `--fg-primary`
    - `fgDimmed` → `--fg-dimmed`
    - `accent` → `--accent`
    - `border` → `--border`
- [x] Verify CSS custom properties match those declared in `global.css`

### Task 3: Mount `ThemeStyleInjector` in App
- [x] Open `src/renderer/components/App.tsx`
- [x] Import `ThemeStyleInjector` from `./ThemeStyleInjector`
- [x] Add `<ThemeStyleInjector />` as a **sibling** of (or just before) the main content tree — placement does not affect render since it returns `null`, but must be inside the Preact component tree so signals work
- [x] Call `initThemeStore()` in App's initialization flow (either in an `useEffect` on mount, or in the module-level app init code — follow the pattern used by other stores like `tab-store`)

### Task 4: Update `TerminalView` to apply xterm.js theme
- [x] Open `src/renderer/components/Terminal/TerminalView.tsx`
- [x] Import `useSignalEffect` from `@preact/signals`
- [x] Import `activeTheme, getCurrentTheme` from `../../state/theme-store`
- [x] In the terminal initialization block (where `new Terminal({...})` is constructed), set `theme` from `getCurrentTheme()`:
  ```typescript
  const terminal = new Terminal({
    // ...existing options
    theme: getCurrentTheme()?.xtermTheme ?? undefined,
  });
  ```
- [x] After terminal is constructed (and before or after `terminal.open()`), add a `useSignalEffect`:
  ```typescript
  useSignalEffect(() => {
    const theme = activeTheme.value;
    if (theme && terminalRef.current) {
      terminalRef.current.options.theme = theme.xtermTheme;
    }
  });
  ```
- [x] Ensure `terminalRef` (or however the xterm.js `Terminal` instance is stored) is accessible in the signal effect scope
- [x] Verify the effect runs for background tabs (not unmounted) — if `TerminalView` is unmounted for background tabs, the signal effect won't run; instead, store theme in a ref updated by signal and apply on mount/focus

### Task 5: Handle the background-tab case
- [x] If `TerminalView` is conditionally rendered (unmounted when tab is inactive), xterm.js `options.theme` cannot be set while unmounted
- [x] Solution: in `TerminalView`'s mount effect (`useEffect`), read `getCurrentTheme()` on mount and apply to the terminal instance — this covers the case where theme changed while tab was in background
- [x] Combine with the signal-driven live update for the foreground tab case
- [x] Add a comment explaining the dual-path pattern

### Task 6: Write unit/integration tests

#### ThemeStore tests (`src/renderer/state/theme-store.test.ts`)
- [x] Test: after `initThemeStore()`, subscribing to `activeTheme` reflects initial value
- [x] Test: simulating a `theme:changed` IPC event updates `activeTheme.value`
- [x] Test: `getCurrentTheme()` returns the latest theme non-reactively
- [x] Mock `window.electronAPI.on` and `window.electronAPI.invoke`

#### ThemeStyleInjector tests (`src/renderer/components/ThemeStyleInjector.test.tsx`)
- [x] Test: setting `activeTheme.value` causes `document.documentElement.style` to have updated CSS vars
- [x] Test: all 6 custom properties (`--bg-terminal`, `--bg-chrome`, `--fg-primary`, `--fg-dimmed`, `--accent`, `--border`) are set
- [x] Test: component renders null (no DOM output)

#### TerminalView tests (`src/renderer/components/Terminal/TerminalView.test.tsx`)
- [x] Test: terminal is initialized with `getCurrentTheme()?.xtermTheme` if available (AC4)
- [x] Test: changing `activeTheme.value` after mount calls `terminal.options.theme = newTheme.xtermTheme` (AC1)
- [x] Mock `Terminal` from xterm.js (already mocked in existing TerminalView tests)

## Dev Notes

### Architecture Patterns

This story implements the **renderer side** of Decision P2-2 (architecture-v2.md). The flow is:

```
main process                    renderer process
─────────────────               ───────────────────────────────────────
ThemeEngine.broadcast()   →     IPC: theme:changed
                                     │
                                     ▼
                                ThemeStore.ts
                                activeTheme.value = newTheme
                                     │
                          ┌──────────┴───────────────┐
                          ▼                          ▼
                  ThemeStyleInjector            TerminalView(s)
                  (useSignalEffect)             (useSignalEffect)
                  CSS custom props              terminal.options.theme
                  on :root                      = xtermTheme
```

**Key constraint:** both CSS custom properties and xterm.js `options.theme` must update in the same JS task. `@preact/signals`'s `useSignalEffect` fires synchronously relative to signal mutations, so both effects will run in the same microtask batch. xterm.js itself re-renders on the next animation frame, but the option is set synchronously — no frame gap.

**`useSignalEffect` vs `useEffect`:** Use `useSignalEffect` (from `@preact/signals`) for reactive updates driven by a signal. This avoids adding `activeTheme` to a dependency array and is idiomatic for the Preact signals pattern used throughout the project.

**CSS custom property naming:** The `global.css` file defines `--bg-terminal`, `--bg-chrome`, `--fg-primary`, `--fg-dimmed`, `--accent`, `--border`. The mapping in `applyChromeCssVars` must use exactly these names (camelCase token keys → kebab-case CSS var names).

**Token key → CSS var mapping:**
```typescript
const CSS_VAR_MAP: Record<keyof ThemeDefinition['chromeTokens'], string> = {
  bgTerminal: '--bg-terminal',
  bgChrome:   '--bg-chrome',
  fgPrimary:  '--fg-primary',
  fgDimmed:   '--fg-dimmed',
  accent:     '--accent',
  border:     '--border',
};
```

**Initial theme on app start:** Before any `theme:changed` event fires, `activeTheme` is `null`. The app should request the active theme during init. Options:
1. Add a `theme:get-active` IPC invoke in `initThemeStore()` that returns the current `ThemeDefinition` from ThemeEngine (preferred — deterministic)
2. Use `theme:list` and match against a stored active ID
3. Inject the active theme as part of the window open payload

Approach 1 is recommended. Add `ipcMain.handle('theme:get-active', () => themeEngine.getActiveTheme())` in `ipc-handlers.ts` if not already present.

**Background tab xterm.js:** If `TerminalView` remains mounted for all tabs (hidden via CSS `display: none`), then `useSignalEffect` handles all tabs uniformly. If tabs are unmounted/remounted, use the `useEffect` on-mount path with `getCurrentTheme()`. Check `TabBar` implementation first to determine which pattern applies.

### Key Files to Create/Modify

| Operation | File | Notes |
|-----------|------|-------|
| CREATE | `src/renderer/state/theme-store.ts` | Signal + IPC listener |
| CREATE | `src/renderer/components/ThemeStyleInjector.tsx` | CSS vars applier, renders null |
| CREATE | `src/renderer/state/theme-store.test.ts` | Vitest unit tests |
| CREATE | `src/renderer/components/ThemeStyleInjector.test.tsx` | Vitest + @testing-library/preact |
| UPDATE | `src/renderer/components/App.tsx` | Mount ThemeStyleInjector, call initThemeStore |
| UPDATE | `src/renderer/components/Terminal/TerminalView.tsx` | Apply xtermTheme on init and on signal change |
| UPDATE | `src/main/ipc-handlers.ts` | Add theme:get-active handler (if approach 1 chosen) |
| UPDATE | `src/shared/channels.ts` | Add THEME_GET_ACTIVE if needed |

### Project Structure Notes

- `ThemeStyleInjector.tsx` has **no CSS Module** — it renders no DOM (returns `null`). Do not create a `.module.css` file for it.
- `theme-store.ts` follows the same pattern as `src/renderer/state/tab-store.ts` — module-level signal, exported init function, exported accessor.
- Do not import `electron` directly in renderer code. All IPC must go through `window.electronAPI` (the preload-exposed contextBridge). Check `src/preload/index.ts` for the existing API surface and add `theme:get-active` invoke if not yet exposed.
- The `activeTheme` signal is module-level (not inside a component). This ensures `TerminalView` instances in multiple tabs all read the same signal — a single source of truth.

### References

- `src/renderer/state/tab-store.ts` — pattern for module-level signals and init functions
- `src/renderer/components/Terminal/TerminalView.tsx` — existing xterm.js Terminal construction pattern
- `src/renderer/components/App.tsx` — existing app init flow and component tree
- `src/preload/index.ts` — contextBridge API; add any new channels here
- `global.css` — CSS custom property declarations (source of truth for var names)
- `src/shared/channels.ts` — IPC channel name constants
- `architecture-v2.md` Decision P2-2 — ThemeEngine and ThemeStore architecture
- xterm.js docs: `Terminal.options.theme` accepts `ITheme` and applies immediately without remounting

## Dev Agent Record

### Agent Model Used
GitHub Copilot (GPT-5.4)

### Debug Log References
- Focused regression run: `npx vitest run src/main/theme-engine.test.ts src/renderer/state/theme-store.test.ts src/renderer/components/ThemeStyleInjector.test.tsx src/renderer/components/Terminal/TerminalView.test.tsx src/renderer/components/App.test.tsx src/shared/config-schema.test.ts` → 93 tests passed
- Full regression run: `npm test` → 35 test files, 457 tests passed
- Targeted lint run: `npx eslint src/renderer/components/App.tsx src/renderer/components/App.test.tsx src/renderer/components/Terminal/TerminalView.test.tsx` → clean
- Full repo lint still reports pre-existing alias-resolution/style issues outside this story’s changes

### Completion Notes
- Audited the existing renderer theme propagation flow already present in the branch and confirmed the shared signal store, CSS variable injector, app wiring, and xterm theme application satisfy AC1-AC4
- Updated `App.tsx` and `App.test.tsx` to use the working relative import paths for `ThemeStyleInjector` and `theme-store`, eliminating the outstanding unresolved-import diagnostics in the renderer bootstrap path
- Repaired `TerminalView.test.tsx` so the xterm/addon mocks are constructible under `new`, then stabilized the accent-edge DOM assertion to reflect the actual rendered structure
- Confirmed the focused theme/font suite and the full regression suite both pass after the cleanup work

### File List
- `src/shared/channels.ts` — theme-related IPC channel constants used by the renderer store
- `src/shared/ipc-types.ts` — shared `ThemeDefinition` typing consumed by renderer theme state
- `src/preload/index.ts` — preload theme bridge exposed to renderer code
- `src/main/ipc-handlers.ts` — active-theme IPC handler support used during renderer init
- `src/renderer/state/theme-store.ts` — module-level renderer theme signal and active-theme initialization
- `src/renderer/state/theme-store.test.ts` — renderer theme-store coverage
- `src/renderer/components/ThemeStyleInjector.tsx` — CSS custom-property synchronization for chrome tokens
- `src/renderer/components/ThemeStyleInjector.test.tsx` — CSS variable application coverage
- `src/renderer/components/App.tsx` — mounts `ThemeStyleInjector` and initializes the theme store
- `src/renderer/components/App.test.tsx` — app-level theme initialization and injector coverage
- `src/renderer/components/Terminal/TerminalView.tsx` — xterm theme application for active and newly mounted terminals
- `src/renderer/components/Terminal/TerminalView.test.tsx` — live theme application and initialization coverage

## Change Log
- 2026-04-05: Validated the existing dual-channel theme application flow, fixed renderer import/test drift, and marked the story ready for review
