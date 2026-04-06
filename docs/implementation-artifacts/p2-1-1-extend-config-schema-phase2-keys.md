# Story P2-1.1: Extend Config Schema with Phase 2 Keys

Status: review

## Story

As a developer,
I want the config schema to include all Phase 2 keys with safe defaults,
so that existing v1 configs load without error and new Phase 2 features have their configuration fields ready.

## Acceptance Criteria

1. **Given** a v1 user with an existing `config.json` that has no Phase 2 keys **When** the app loads and `configStore.get()` is called **Then** the v1 config parses successfully with no errors and Phase 2 keys resolve to their Zod defaults

2. **Given** the updated config schema **When** TypeScript compiles the project (`npx tsc --noEmit`) **Then** there are no type errors in `config-schema.ts`, `config-types.ts`, `config-store.ts`, or any file importing from `@shared/config-schema`

3. **Given** the new `theme` config key **When** no `theme` value is present in the user's config **Then** `theme` defaults to `'tokyo-night'`

4. **Given** the new `window.widthPercent` config key **When** no value is present **Then** it defaults to `100` (full-width, preserving v1 behaviour)

5. **Given** the new `window.monitor` config key **When** no value is present **Then** it defaults to `'active'`

6. **Given** the new `tabs.colorPalette` config key **When** no value is present **Then** it defaults to `['#7aa2f7','#9ece6a','#bb9af7','#e0af68','#7dcfff','#f7768e']`

7. **Given** the new `tabs.maxTabs` config key **When** no value is present **Then** it defaults to `10`

8. **Given** the new `acrylicBlur` config key **When** no value is present **Then** it defaults to `false`

9. **Given** any invalid value for a new Phase 2 key (e.g., `window.widthPercent: 999`) **When** the config file is loaded and `configSchema.safeParse()` is called **Then** Zod validation rejects the invalid field and the calling code (config-store.ts) falls back to the default, with a warning logged via `electron-log`

10. **Given** the new `window` sub-object in the schema **When** a v1 config with a top-level `dropHeight` key (the v1 window height field) is loaded **Then** `dropHeight` continues to parse successfully, `window.heightPercent` resolves to its default `30`, and no data is lost

## Tasks / Subtasks

- [x] Task 1: Add Phase 2 fields to `src/shared/config-schema.ts` (AC: #1, #3–#10)
  - [x] 1.1: Add `theme: z.string().default('tokyo-night')` at the top level of `configSchema`
  - [x] 1.2: Add a new `window` sub-object alongside the existing flat keys (do **not** remove `dropHeight` — it stays for v1 compat):
    ```typescript
    window: z.object({
      heightPercent: z.number().min(10).max(90).default(30),
      widthPercent: z.number().min(20).max(100).default(100),
      monitor: z
        .union([z.literal('active'), z.literal('primary'), z.number().int().min(0)])
        .default('active'),
    }).default({}),
    ```
  - [x] 1.3: Add a new `tabs` sub-object at the top level:
    ```typescript
    tabs: z.object({
      colorPalette: z
        .array(z.string().regex(/^#[0-9a-fA-F]{6}$/))
        .min(1)
        .default(['#7aa2f7', '#9ece6a', '#bb9af7', '#e0af68', '#7dcfff', '#f7768e']),
      maxTabs: z.number().int().min(1).max(20).default(10),
    }).default({}),
    ```
  - [x] 1.4: Add `acrylicBlur: z.boolean().default(false)` at the top level
  - [x] 1.5: Verify `configDefaults` (the `configSchema.parse({})` export at the bottom of the file) still compiles and includes all new fields

- [x] Task 2: Update `src/shared/config-types.ts` with new exported helper types (AC: #2)
  - [x] 2.1: The file currently re-exports `Config` from `config-schema.ts`. Add named type exports for the new nested sub-objects so downstream code can type-narrow without re-importing the full schema:
    ```typescript
    export type { Config } from './config-schema';
    export type WindowConfig = Config['window'];
    export type TabsConfig = Config['tabs'];
    export type MonitorTarget = Config['window']['monitor'];
    ```
  - [x] 2.2: Run `npx tsc --noEmit` and confirm zero errors

- [x] Task 3: Verify `src/main/config-store.ts` requires no changes (AC: #1, #9)
  - [x] 3.1: Read `src/main/config-store.ts` and confirm it calls `configSchema.parse()` or `configSchema.safeParse()` — the schema does all the migration work; no code changes expected
  - [x] 3.2: If config-store uses `configSchema.parse()` (throw on invalid), consider if it should use `safeParse()` + log-warning + fallback-to-defaults to satisfy AC #9. If a change is needed, add `safeParse()` fallback with `log.scope('config-store').warn(...)` and then `configSchema.parse({})` as the fallback value
  - [x] 3.3: Confirm `configStore.getAll()` return type still satisfies `Config` after schema changes

- [x] Task 4: Write tests in `src/shared/config-schema.test.ts` (AC: #1, #3–#10)
  - [x] 4.1: Create `src/shared/config-schema.test.ts` (file does not yet exist)
  - [x] 4.2: Test: empty object parses to all defaults — assert `theme === 'tokyo-night'`, `window.widthPercent === 100`, `window.monitor === 'active'`, `tabs.maxTabs === 10`, `acrylicBlur === false`, `tabs.colorPalette` has 6 entries
  - [x] 4.3: Test: v1 config object (contains `dropHeight`, `hotkey`, `opacity`, etc., but no Phase 2 keys) parses without error and Phase 2 fields resolve to defaults
  - [x] 4.4: Test: `window.widthPercent: 999` is rejected by `safeParse()` (`success === false`); `window.widthPercent: 19` is also rejected (below min 20); `window.widthPercent: 20` is accepted
  - [x] 4.5: Test: `window.monitor` accepts `'active'`, `'primary'`, and integer `0` / `1` / `2`; rejects `'secondary'`, `-1`, `3.5`
  - [x] 4.6: Test: `tabs.colorPalette` rejects an array containing a non-hex-color string (e.g., `'red'`)
  - [x] 4.7: Test: `tabs.maxTabs: 21` is rejected (above max 20); `tabs.maxTabs: 0` is rejected (below min 1)
  - [x] 4.8: Test: `configDefaults` export contains the expected default values for all Phase 2 fields
  - [x] 4.9: Run `npx vitest run src/shared/config-schema.test.ts` — all tests pass

## Dev Notes

### Architecture Patterns

- **Additive-only schema changes via Zod `.default()`**: All new fields must have a `.default()` value. This means `configSchema.parse({})` succeeds (produces all defaults) and `configSchema.parse(v1Config)` succeeds (v1 keys preserved, new keys defaulted). This is the NFR-P2-07 contract.
- **Nested sub-objects with `.default({})`**: When adding a new sub-object to the schema (e.g., `window`, `tabs`), the sub-object itself must also have `.default({})` so that a config file with no `window` key at all still parses cleanly. Each field inside the sub-object has its own `.default()`.
- **`dropHeight` vs `window.heightPercent`**: v1 used a flat `dropHeight` key. Phase 2 introduces `window.heightPercent` inside a sub-object. This story adds `window.heightPercent` as a **new, independent** field alongside the existing `dropHeight`. Both co-exist in the schema. The window-manager story in Epic 5 will decide which field is the authoritative source at runtime. Do **not** remove or rename `dropHeight` in this story.
- **`z.union()` for `monitor`**: The `monitor` field accepts `'active' | 'primary' | number`. Use `z.union([z.literal('active'), z.literal('primary'), z.number().int().min(0)])` — not `z.string()` — so that numeric monitor indices are validated as non-negative integers.
- **Hex color validation in palette**: Use `z.string().regex(/^#[0-9a-fA-F]{6}$/)` rather than plain `z.string()` so the palette array rejects malformed values at config load time rather than at render time.
- **`configDefaults` export**: `config-schema.ts` exports `export const configDefaults: Config = configSchema.parse({})`. After adding new fields, this call must still succeed. Verify it as part of the task.

### Key Files to Create/Modify

| File | Change |
|------|--------|
| `src/shared/config-schema.ts` | Add `theme`, `window` sub-object, `tabs` sub-object, `acrylicBlur` fields (additive) |
| `src/shared/config-types.ts` | Add `WindowConfig`, `TabsConfig`, `MonitorTarget` type exports |
| `src/shared/config-schema.test.ts` | **Create new** — tests for new defaults, edge cases, v1 compat |
| `src/main/config-store.ts` | No change expected; verify only |

### Current v1 Schema (for reference — do not remove any of these)

```typescript
// src/shared/config-schema.ts — current v1 fields (all must be preserved)
hotkey: z.string().default('Ctrl+Shift+Q'),
defaultShell: z.string().default('powershell'),
opacity: z.number().min(0).max(1).default(0.85),
focusFade: z.boolean().default(true),
animationSpeed: z.number().min(0).max(1000).default(200),
fontSize: z.number().min(8).max(32).default(14),
fontFamily: z.string().default('Cascadia Code, Consolas, Courier New, monospace'),
dropHeight: z.number().min(10).max(100).default(30),  // ← keep; DO NOT remove
autostart: z.boolean().default(true),
firstRun: z.boolean().default(true),
```

### Target Shape After This Story

```typescript
export const configSchema = z.object({
  // --- v1 keys (unchanged) ---
  hotkey: z.string().default('Ctrl+Shift+Q'),
  defaultShell: z.string().default('powershell'),
  opacity: z.number().min(0).max(1).default(0.85),
  focusFade: z.boolean().default(true),
  animationSpeed: z.number().min(0).max(1000).default(200),
  fontSize: z.number().min(8).max(32).default(14),
  fontFamily: z.string().default('Cascadia Code, Consolas, Courier New, monospace'),
  dropHeight: z.number().min(10).max(100).default(30),
  autostart: z.boolean().default(true),
  firstRun: z.boolean().default(true),
  // --- Phase 2 additions ---
  theme: z.string().default('tokyo-night'),
  window: z.object({
    heightPercent: z.number().min(10).max(90).default(30),
    widthPercent: z.number().min(20).max(100).default(100),
    monitor: z
      .union([z.literal('active'), z.literal('primary'), z.number().int().min(0)])
      .default('active'),
  }).default({}),
  tabs: z.object({
    colorPalette: z
      .array(z.string().regex(/^#[0-9a-fA-F]{6}$/))
      .min(1)
      .default(['#7aa2f7', '#9ece6a', '#bb9af7', '#e0af68', '#7dcfff', '#f7768e']),
    maxTabs: z.number().int().min(1).max(20).default(10),
  }).default({}),
  acrylicBlur: z.boolean().default(false),
});
```

### Project Structure Notes

- `src/shared/` is imported by BOTH the main and renderer processes. Changes here are "shared" — no Electron-specific API (no `ipcMain`, no `BrowserWindow`) should ever appear in this directory.
- `config-schema.ts` is the source of truth for the entire config structure. `config-types.ts` is a thin re-export layer — its only job is to surface named types. Do not add logic to `config-types.ts`.
- Tests in `src/shared/` run in Node environment (no DOM, no Electron). Vitest config at `vitest.config.ts` — confirm the test runner includes `src/shared/**`.
- `configDefaults` is used in `config-store.ts` as the fallback when the stored config is entirely missing. It must remain a valid parse result after schema changes.

### Testing Notes

- Use `configSchema.parse({})` (throws on failure) in happy-path tests to keep assertions concise.
- Use `configSchema.safeParse(input)` (returns `{ success, data, error }`) in negative-path tests to inspect the Zod error without try/catch.
- The v1 compat test is the most important: construct a realistic v1 config object (the shape electron-store would have written to disk) and assert `safeParse` returns `success: true`.

### References

- [Source: docs/planning-artifacts/architecture-v2.md — Decision P2-3 (Config Schema Extension)]
- [Source: docs/planning-artifacts/epics-v2.md — Epic 1, Story 1.1]
- [Source: docs/planning-artifacts/epics-v2.md — NFR-P2-07, ARCH-P2-08]
- [Related: src/shared/config-schema.ts — current v1 schema]
- [Related: src/main/config-store.ts — consumer of schema; no changes expected]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (GitHub Copilot)

### Debug Log References
- `npx tsc --noEmit` shows pre-existing `@types/node` errors in node_modules but zero errors in `src/` — confirmed not introduced by this story
- Existing `config-schema.test.ts` already existed (created in story 1-1) — updated existing tests to include Phase 2 fields rather than creating new file
- `config-store.ts` already uses `safeParse()` with field-level correction and `logger.warn()` — no changes needed for AC #9

### Completion Notes
- Added 4 Phase 2 fields to `configSchema`: `theme`, `window` (nested sub-object with `heightPercent`, `widthPercent`, `monitor`), `tabs` (nested with `colorPalette`, `maxTabs`), `acrylicBlur`
- All fields use `.default()` ensuring v1 configs parse without error (NFR-P2-07)
- `window` and `tabs` sub-objects use `.default({})` for clean parsing when absent
- `monitor` uses `z.union()` for `'active' | 'primary' | number` validation
- `colorPalette` uses regex validation for hex color format
- Added `WindowConfig`, `TabsConfig`, `MonitorTarget` type exports to `config-types.ts`
- `config-store.ts` verified compatible — already uses `safeParse()` with field-level fallback
- Updated existing test file with 25 new Phase 2 tests (38 total); all pass
- Full regression suite: 355 tests across 26 files, all pass

### File List
- `src/shared/config-schema.ts` (modified) — Added `theme`, `window` sub-object, `tabs` sub-object, `acrylicBlur` Phase 2 fields
- `src/shared/config-types.ts` (modified) — Added `WindowConfig`, `TabsConfig`, `MonitorTarget` type exports
- `src/shared/config-schema.test.ts` (modified) — Updated existing v1 tests for new schema shape, added 25 Phase 2 tests

## Change Log
- 2026-04-04: Story P2-1.1 implemented — Extended config schema with Phase 2 keys (theme, window, tabs, acrylicBlur) with safe defaults and full v1 backward compatibility
