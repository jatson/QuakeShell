# Story P2-4.4: Font Configuration

Status: review

## Story

As a user, I want to configure the terminal font family, size, and line height, so that I can adjust the terminal to my visual preferences and accessibility needs.

## Acceptance Criteria

- **AC1:** Given `config.fontFamily` is set to `'JetBrains Mono'` / When the terminal renders / Then xterm.js `options.fontFamily` is updated to `'JetBrains Mono'`.
- **AC2:** Given `config.fontSize` is set to `16` / When the terminal renders / Then xterm.js `options.fontSize` is `16` and hot-reload applies without restart.
- **AC3:** Given `config.lineHeight` is set to `1.4` / When applied / Then xterm.js `options.lineHeight` is `1.4` and the terminal reflows.
- **AC4:** Given font config changes via hot-reload / When the config watcher fires / Then xterm.js options update and the terminal reflows in the current frame — no restart required.
- **AC5:** Given `config.fontSize` is set to an out-of-range value (e.g., `5` or `72`) / When validated / Then Zod schema rejects the value and a sensible default (`14`) is used with a warning logged.

## Tasks / Subtasks

### Task 1: Audit the existing config schema
- [x] Open `src/shared/config-schema.ts`
- [x] Check whether `fontFamily`, `fontSize`, and `lineHeight` are already defined
- [x] Check whether `fontSize` hot-reload is already implemented in `TerminalView.tsx`
- [x] Document findings before proceeding — only add what is missing
- [x] Expected existing state: `fontFamily` (string) and `fontSize` (number) are present from v1; `lineHeight` is likely absent

### Task 2: Add `lineHeight` to config schema (if missing)
- [x] If `lineHeight` is not in the Zod schema, add it to `config-schema.ts`:
  ```typescript
  lineHeight: z.number().min(1.0).max(2.0).default(1.2),
  ```
- [x] Place it adjacent to `fontSize` and `fontFamily` for readability
- [x] Confirm the default value (`1.2`) matches what is currently hardcoded in `TerminalView.tsx` (if any); use whatever is already in use to avoid visual change on first run

### Task 3: Confirm/tighten existing `fontSize` schema constraints
- [x] Verify `fontSize` in the schema has appropriate min/max:
  ```typescript
  fontSize: z.number().int().min(8).max(64).default(14),
  ```
- [x] If current constraints differ (e.g., min is too low or max is too high), update to `min(8).max(64)`
- [x] If `fontSize` is currently `z.number()` without bounds, add `.int().min(8).max(64).default(14)` now
- [x] Verify `fontFamily` has a sensible default string (e.g., `'Cascadia Code, Consolas, monospace'`)

### Task 4: Update `TerminalView` to hot-reload all three font options
- [x] Open `src/renderer/components/Terminal/TerminalView.tsx`
- [x] Locate where xterm.js `Terminal` is initialized — verify `fontFamily` and `fontSize` are passed from config:
  ```typescript
  const terminal = new Terminal({
    fontFamily: config.fontFamily,
    fontSize: config.fontSize,
    lineHeight: config.lineHeight ?? 1.2,
    // ...other options
  });
  ```
- [x] Locate the existing config change effect (the signal or event listener watching config updates)
- [x] If `fontSize` hot-reload already exists and uses `terminal.options.fontSize = newSize`, extend the same effect to also update `fontFamily` and `lineHeight`:
  ```typescript
  useSignalEffect(() => {
    const cfg = configSignal.value; // or however config is read reactively
    if (!terminalRef.current) return;
    terminalRef.current.options.fontFamily = cfg.fontFamily;
    terminalRef.current.options.fontSize = cfg.fontSize;
    terminalRef.current.options.lineHeight = cfg.lineHeight;
  });
  ```
- [x] After updating xterm.js options, call `terminal.refresh(0, terminal.rows - 1)` to force a reflow if xterm.js does not reflow automatically — check xterm.js docs; `options.fontSize` assignment typically triggers reflow, but `fontFamily` may not
- [x] If using `terminal.resize()` to force reflow: call `terminal.resize(terminal.cols, terminal.rows)` — this is a no-op in terms of size but triggers re-render

### Task 5: Verify terminal initialization reads config values
- [x] Confirm that when a new terminal (new tab) is created after a font config change, it picks up the current config values (not hardcoded defaults)
- [x] If config is read from a signal: `configSignal.peek()` at construction time is correct
- [x] If config is read from an async IPC call: ensure the latest values are available by the time `new Terminal({...})` is called

### Task 6: Write/update unit tests for schema validation
- [x] Open (or create) `src/shared/config-schema.test.ts`
- [x] Test: `lineHeight` coerces valid values correctly (`1.0`, `1.2`, `2.0`)
- [x] Test: `lineHeight` rejects values below `1.0` (e.g., `0.8`) with a Zod error
- [x] Test: `lineHeight` rejects values above `2.0` (e.g., `2.5`) with a Zod error
- [x] Test: `lineHeight` uses default `1.2` when not provided
- [x] Test: `fontSize` rejects `5` (below min 8) — expect Zod parse error
- [x] Test: `fontSize` rejects `72` (above max 64) — expect Zod parse error
- [x] Test: `fontSize` uses default `14` when not provided
- [x] Test: `fontFamily` accepts any non-empty string
- [x] Use Zod's `.safeParse()` in tests for clean assertions

### Task 7: Write/update TerminalView font hot-reload tests
- [x] Open `src/renderer/components/Terminal/TerminalView.test.tsx`
- [x] Test (AC1): updating `configSignal.value.fontFamily` causes `terminal.options.fontFamily` to update
- [x] Test (AC2): updating `configSignal.value.fontSize` causes `terminal.options.fontSize` to update (likely already tested — verify and update if needed)
- [x] Test (AC3): updating `configSignal.value.lineHeight` causes `terminal.options.lineHeight` to update
- [x] Test (AC4): all three options update without remounting the terminal component
- [x] Mock `Terminal` from xterm.js (use existing mock pattern in `TerminalView.test.tsx`)

## Dev Notes

### Architecture Patterns

Font configuration is a pure **renderer-side concern** — config values flow from `ConfigStore` signal into `TerminalView` via `useSignalEffect`, exactly like the theme xterm.js channel in P2-4.2. Unlike theming, there is no separate "font engine" in the main process.

**xterm.js option assignment and reflow:**

xterm.js `Terminal.options` is a live setter proxy. Assigning to individual options triggers internal updates:
- `options.fontSize` → triggers full reflow (row height changes)
- `options.fontFamily` → **may not** trigger reflow automatically; call `terminal.refresh(0, terminal.rows - 1)` after
- `options.lineHeight` → triggers reflow (affects row height)

To be safe, assign all three and then call refresh once:
```typescript
terminal.options.fontFamily = newFontFamily;
terminal.options.fontSize = newFontSize;
terminal.options.lineHeight = newLineHeight;
// Force reflow for fontFamily (fontSize and lineHeight trigger it automatically)
terminal.refresh(0, terminal.rows - 1);
```

Or use `terminal.resize()` which is a documented way to force a full reflow:
```typescript
terminal.resize(terminal.cols, terminal.rows);
```

**Zod validation at the config layer:**

When the config file is loaded and `JSON.parse`d, it goes through the Zod schema. Invalid values (e.g., `fontSize: 5`) will cause a Zod `ZodError`. The existing ConfigStore likely handles this by:
1. Logging the Zod error
2. Falling back to the schema's default value

Check `src/main/config-store.ts` for the error handling pattern. If it uses `.safeParse()`, the defaults are applied per-field. If it uses `.parse()`, the entire config might reject — verify this and ensure font fields are handled gracefully.

**AC5 implementation note:** Zod `.min()` / `.max()` on `z.number()` does **not** coerce out-of-range values to the default — it throws a validation error. In `.safeParse()` mode, the entire parse may fail rather than clamping individual fields. If the desired behavior is to clamp (not reject), use `.transform()`:
```typescript
fontSize: z.number().transform(v => Math.max(8, Math.min(64, v))).default(14),
```
However, the AC says "Zod schema clamps **or** rejects" — prefer `.min(8).max(64)` (reject) with ConfigStore falling back to default, which is simpler and more predictable. Update the AC interpretation comment in tests.

**Hot-reload signal pattern:**

The project uses `@preact/signals` for reactive config. The pattern in `TerminalView` should match what is already done for font size (if it exists). Look for:
```typescript
// Existing pattern (likely something like):
useSignalEffect(() => {
  const size = config.fontSize; // reactive read
  terminal.options.fontSize = size;
});
```
Extend this same effect to cover `fontFamily` and `lineHeight` — do not create separate effects for each; batch them in one `useSignalEffect` to avoid multiple re-renders.

**`lineHeight` default value:** xterm.js default `lineHeight` is `1.0`. A value of `1.2` gives slightly more breathing room. Match whatever the current terminal initialization uses. If the terminal is currently initialized with `lineHeight: 1.0` (xterm.js default), use `1.0` as the Zod default to avoid a visual change.

### Key Files to Create/Modify

| Operation | File | Notes |
|-----------|------|-------|
| MINOR UPDATE | `src/shared/config-schema.ts` | Add `lineHeight` if missing; tighten fontSize bounds |
| UPDATE | `src/renderer/components/Terminal/TerminalView.tsx` | Extend font hot-reload effect to fontFamily and lineHeight |
| UPDATE | `src/shared/config-schema.test.ts` | Add lineHeight and fontSize boundary tests |
| UPDATE | `src/renderer/components/Terminal/TerminalView.test.tsx` | Add fontFamily and lineHeight hot-reload tests |

### Project Structure Notes

- This story has **no new files** — it is purely additive changes to existing files.
- `lineHeight` is the only potentially missing config field. `fontFamily` and `fontSize` are expected to already exist from v1.
- There are **no IPC changes** for this story — font settings live in config, and config is already read in the renderer via the existing ConfigStore signal mechanism.
- If `fontFamily` hot-reload already works (unlikely, as v1 focused on fontSize), this story is mostly tests and the `lineHeight` addition.
- xterm.js version matters for `options.lineHeight` support — verify the installed version of `xterm` in `package.json` supports `options.lineHeight` (it has been available since xterm.js v4.x; `@xterm/xterm` v5.x definitely supports it).

### References

- `src/shared/config-schema.ts` — existing Zod schema; check for `fontFamily`, `fontSize`, `lineHeight`
- `src/renderer/components/Terminal/TerminalView.tsx` — existing xterm.js Terminal construction and font handling
- `src/main/config-store.ts` — ConfigStore Zod parse error handling pattern
- `src/shared/config-schema.test.ts` — existing schema validation tests (extend, do not replace)
- xterm.js API: `Terminal.options.fontFamily` (string), `Terminal.options.fontSize` (number, px), `Terminal.options.lineHeight` (number, multiplier ≥ 1.0)
- xterm.js API: `Terminal.refresh(start, end)` — forces re-render of rows `start` through `end`
- Zod docs: `.min()`, `.max()`, `.default()`, `.transform()`, `.safeParse()`

## Dev Agent Record

### Agent Model Used
GitHub Copilot (GPT-5.4)

### Debug Log References
- Focused regression run: `npx vitest run src/main/theme-engine.test.ts src/renderer/state/theme-store.test.ts src/renderer/components/ThemeStyleInjector.test.tsx src/renderer/components/Terminal/TerminalView.test.tsx src/renderer/components/App.test.tsx src/shared/config-schema.test.ts` → 93 tests passed
- Full regression run: `npm test` → 35 test files, 457 tests passed
- Targeted lint run: `npx eslint src/renderer/components/App.tsx src/renderer/components/App.test.tsx src/renderer/components/Terminal/TerminalView.test.tsx` → clean
- Full repo lint still reports pre-existing alias-resolution/style issues outside this story’s changes

### Completion Notes
- Audited the existing font configuration implementation already present in the branch and confirmed the shared config schema and terminal font hot-reload path satisfy AC1-AC5
- Confirmed `fontFamily`, `fontSize`, and `lineHeight` are represented in the shared config schema with the expected validation boundaries and defaults
- Verified `TerminalView` initializes new xterm instances from the current config and applies live font option updates without remounting
- The cleanup work in this pass repaired the shared `TerminalView.test.tsx` xterm mock construction path used by the theme/font regression suite, after which the focused and full regression suites both passed

### File List
- `src/shared/config-schema.ts` — font configuration schema and defaults
- `src/shared/config-schema.test.ts` — schema validation coverage for font settings
- `src/renderer/components/Terminal/TerminalView.tsx` — xterm font initialization and live option updates
- `src/renderer/components/Terminal/TerminalView.test.tsx` — font hot-reload and xterm option coverage

## Change Log
- 2026-04-05: Validated the existing font configuration implementation, stabilized shared terminal regression tests, and marked the story ready for review
