# Story 1.2: Configuration System with Schema Validation

Status: review

## Story

As a developer,
I want a configuration system that persists settings to disk with schema validation and exposes config via IPC,
So that all features can rely on a type-safe, validated configuration that survives restarts.

## Acceptance Criteria

1. **Given** the shared config schema file `src/shared/config-schema.ts` **When** a Zod schema is defined for the QuakeShell config **Then** the schema includes all v1 settings with defaults: `hotkey` (default: `"Ctrl+Shift+Q"`), `defaultShell` (default: `"powershell"`), `opacity` (default: `0.85`), `focusFade` (default: `true`), `animationSpeed` (default: `200`), `fontSize` (default: `14`), `fontFamily` (default: `"Cascadia Code, Consolas, Courier New, monospace"`), `dropHeight` (default: `30`), `autostart` (default: `true`), `firstRun` (default: `true`) **And** `z.infer<>` produces the `Config` TypeScript type

2. **Given** the IPC channel constants file `src/shared/channels.ts` **When** channels are defined **Then** all IPC channel names follow the `domain:action` convention (e.g., `config:get`, `config:set`, `config:get-all`) and are exported as typed constants

3. **Given** the `src/main/config-store.ts` module **When** it initializes with electron-store **Then** the store loads the config file from disk, validates it against the Zod schema using `safeParse()`, and exposes `get(key)`, `set(key, value)`, and `getAll()` methods

4. **Given** a config file that contains invalid values **When** `config-store.ts` loads it at startup **Then** invalid fields fall back to their Zod-defined defaults, a warning is logged via the scoped logger, and the corrected config is saved back to disk

5. **Given** a config file is missing entirely **When** `config-store.ts` initializes **Then** a new config file is created with all Zod default values

6. **Given** the `src/main/ipc-handlers.ts` module **When** IPC handlers are registered **Then** `config:get-all` returns the full config object via `invoke`/`handle`, and `config:set` accepts a key-value pair, validates via Zod, persists to disk, and returns the updated value

7. **Given** the preload contextBridge **When** `quakeshell.config` methods are called from the renderer **Then** `getAll()` returns the full config and `set(key, value)` updates a single config value, both via `invoke`

8. **Given** config-store is initialized **When** a unit test validates the Zod schema **Then** valid configs pass, invalid configs fall back to defaults, and the test file is co-located as `src/main/config-store.test.ts`

## Tasks / Subtasks

- [x] Task 1: Define Zod config schema with defaults (AC: #1)
  - [x] 1.1: Create/populate `src/shared/config-schema.ts` with a Zod object schema
  - [x] 1.2: Define all v1 config fields with their types and defaults:
    - `hotkey`: `z.string().default("Ctrl+Shift+Q")`
    - `defaultShell`: `z.string().default("powershell")`
    - `opacity`: `z.number().min(0).max(1).default(0.85)`
    - `focusFade`: `z.boolean().default(true)`
    - `animationSpeed`: `z.number().min(50).max(1000).default(200)`
    - `fontSize`: `z.number().min(8).max(32).default(14)`
    - `fontFamily`: `z.string().default("Cascadia Code, Consolas, Courier New, monospace")`
    - `dropHeight`: `z.number().min(10).max(100).default(30)`
    - `autostart`: `z.boolean().default(true)`
    - `firstRun`: `z.boolean().default(true)`
  - [x] 1.3: Export `configSchema` (the Zod schema) and `Config` type via `z.infer<typeof configSchema>`
  - [x] 1.4: Export a `configDefaults` constant by parsing an empty object through the schema

- [x] Task 2: Define IPC channel constants (AC: #2)
  - [x] 2.1: Populate `src/shared/channels.ts` with typed constant exports
  - [x] 2.2: Define config channels: `config:get-all`, `config:set`, `config:get`
  - [x] 2.3: Add placeholder channel groups for future stories:
    - Terminal: `terminal:spawn`, `terminal:write`, `terminal:resize`, `terminal:data`
    - Window: `window:toggle`, `window:state-changed`
    - App: `app:quit`, `app:get-version`
  - [x] 2.4: Use `as const` assertions for all channel string literals
  - [x] 2.5: Ensure `domain:action` naming convention is enforced via naming pattern

- [x] Task 3: Implement config-store module (AC: #3, #4, #5)
  - [x] 3.1: Create `src/main/config-store.ts` module
  - [x] 3.2: Import `electron-store` (handle ESM-only: use dynamic `import()` or top-level await)
  - [x] 3.3: Create a scoped `electron-log` logger: `log.scope('config-store')`
  - [x] 3.4: On initialization, load existing config from disk via electron-store
  - [x] 3.5: Validate loaded config with `configSchema.safeParse()`
  - [x] 3.6: If `safeParse` fails or has partial errors, merge valid fields with Zod defaults
  - [x] 3.7: Log warnings for any invalid/corrected fields via scoped logger
  - [x] 3.8: Save corrected config back to disk if corrections were made
  - [x] 3.9: If config file is missing, create it with all Zod default values
  - [x] 3.10: Expose named exports: `get(key)`, `set(key, value)`, `getAll()`
  - [x] 3.11: `set(key, value)` must validate the individual field against Zod before persisting
  - [x] 3.12: Use `async/await` pattern — no `.then()` chains

- [x] Task 4: Implement IPC handlers for config (AC: #6)
  - [x] 4.1: Create `src/main/ipc-handlers.ts` as the SINGLE IPC registration point
  - [x] 4.2: Import channel constants from `@shared/channels`
  - [x] 4.3: Register `ipcMain.handle(CHANNELS.CONFIG_GET_ALL, ...)` → returns `configStore.getAll()`
  - [x] 4.4: Register `ipcMain.handle(CHANNELS.CONFIG_SET, ...)` → accepts `{ key, value }`, validates via Zod, persists, returns updated value
  - [x] 4.5: Wrap all handlers in try/catch with error logging via scoped logger
  - [x] 4.6: Export a `registerIpcHandlers()` function called from `src/main/index.ts` on app ready
  - [x] 4.7: Ensure no module directly imports `ipcMain` except `ipc-handlers.ts`

- [x] Task 5: Wire config into preload contextBridge (AC: #7)
  - [x] 5.1: Update `src/preload/index.ts` to populate the `config` namespace on `window.quakeshell`
  - [x] 5.2: Implement `config.getAll()` → `ipcRenderer.invoke(CHANNELS.CONFIG_GET_ALL)`
  - [x] 5.3: Implement `config.set(key, value)` → `ipcRenderer.invoke(CHANNELS.CONFIG_SET, { key, value })`
  - [x] 5.4: Update TypeScript type declarations for `window.quakeshell.config` in `src/shared/ipc-types.ts`
  - [x] 5.5: Ensure `ipcRenderer` is NOT exposed directly — only wrapped invoke calls

- [x] Task 6: Write unit tests for config schema and store (AC: #8)
  - [x] 6.1: Create `src/main/config-store.test.ts` (co-located test)
  - [x] 6.2: Test: valid config passes schema validation
  - [x] 6.3: Test: empty object produces all defaults
  - [x] 6.4: Test: invalid field values fall back to defaults (e.g., `opacity: 2` → `0.85`)
  - [x] 6.5: Test: partial config retains valid fields and fills missing ones with defaults
  - [x] 6.6: Test: `set()` rejects invalid values
  - [x] 6.7: Create `src/shared/config-schema.test.ts` for pure schema validation tests
  - [x] 6.8: Run `npm test` and verify all tests pass

## Dev Notes

### Architecture Patterns

- **electron-store v11 is ESM-only**: This is a critical integration point. The main process Vite config must handle ESM imports correctly. Option 1: Use dynamic `const Store = (await import('electron-store')).default`. Option 2: Ensure Forge's Vite config outputs ESM for main process. Test this early.
- **Zod v4.3.6 safeParse pattern**: Use `configSchema.safeParse(data)` which returns `{ success, data, error }`. On failure, extract `error.issues` for logging. Merge partial valid data with defaults using `configSchema.parse({})` for the default baseline.
- **Single IPC registration point**: `src/main/ipc-handlers.ts` is the ONLY file that imports `ipcMain`. All other modules expose functions that `ipc-handlers.ts` calls. This centralizes the IPC surface for security auditing.
- **Channel naming convention**: All IPC channels use `domain:action` format. Constants defined in `@shared/channels.ts` — no magic strings anywhere. Both main and preload import from the same source of truth.
- **contextBridge wrapping**: Preload script wraps each IPC call in a function. Renderer code calls `window.quakeshell.config.getAll()` — never sees `ipcRenderer` directly.
- **Scoped logging**: `electron-log.scope('config-store')` for config module, `electron-log.scope('ipc')` for IPC handlers. Zero `console.log`.
- **Error handling at IPC boundary**: Every `ipcMain.handle` callback wrapped in try/catch. Errors logged and re-thrown as serializable error objects.

### Config File Location

electron-store stores config at:
```
%APPDATA%/QuakeShell/config.json
```

### Zod Schema Design

```typescript
// src/shared/config-schema.ts
import { z } from 'zod';

export const configSchema = z.object({
  hotkey: z.string().default('Ctrl+Shift+Q'),
  defaultShell: z.string().default('powershell'),
  opacity: z.number().min(0).max(1).default(0.85),
  focusFade: z.boolean().default(true),
  animationSpeed: z.number().min(50).max(1000).default(200),
  fontSize: z.number().min(8).max(32).default(14),
  fontFamily: z.string().default('Cascadia Code, Consolas, Courier New, monospace'),
  dropHeight: z.number().min(10).max(100).default(30),
  autostart: z.boolean().default(true),
  firstRun: z.boolean().default(true),
});

export type Config = z.infer<typeof configSchema>;
```

### IPC Channel Constants Pattern

```typescript
// src/shared/channels.ts
export const CHANNELS = {
  CONFIG_GET_ALL: 'config:get-all',
  CONFIG_SET: 'config:set',
  CONFIG_GET: 'config:get',
  // ... more channels added by later stories
} as const;
```

### Dependencies (from Story 1.1)

| Package | Version | Role |
|---------|---------|------|
| `electron-store` | 11.0.2 | Config persistence to disk |
| `zod` | 4.3.6 | Schema validation + type inference |
| `electron-log` | 5.4.3 | Scoped logging |
| `vitest` | 4.1.2 | Unit testing |

### Testing Standards

- **Framework**: Vitest 4.1.2
- **Co-located tests**: `src/main/config-store.test.ts`, `src/shared/config-schema.test.ts`
- **Mocking**: electron-store must be mocked in unit tests (no real disk I/O)
- **Coverage targets**: All Zod schema branches, all config-store methods, all IPC handlers

### Project Structure Notes

Files to **create**:
```
src/
  main/
    config-store.ts          # electron-store + Zod validation, get/set/getAll
    config-store.test.ts     # Unit tests for config store
    ipc-handlers.ts          # Single IPC registration point (ipcMain.handle)
  shared/
    channels.ts              # IPC channel name constants (domain:action)
    config-schema.ts         # Zod schema + Config type + defaults
    config-schema.test.ts    # Unit tests for schema validation
```

Files to **modify**:
```
src/
  main/
    index.ts                 # Call registerIpcHandlers() on app ready
  preload/
    index.ts                 # Populate quakeshell.config namespace
  shared/
    ipc-types.ts             # Add window.quakeshell.config type declarations
```

### References

- Architecture: `docs/planning-artifacts/architecture.md` — IPC architecture, config-store pattern, channel naming convention
- PRD: `docs/planning-artifacts/prd.md` — FR14-FR20 (configuration), NFR16 (state persistence), NFR19 (corruption fallback)
- Epics: `docs/planning-artifacts/epics.md` — Epic 1, Story 1.2
- UX Design: `docs/planning-artifacts/ux-design-specification.md` — Default config values (opacity, font, animation speed)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- No halts or blockers encountered during implementation.
- electron-store v11 ESM type resolution requires `as unknown as ElectronStoreInstance` cast due to `moduleResolution: "node"` in tsconfig (runtime unaffected — Vite handles ESM bundling).
- Existing `shared.test.ts` reference to `Channels` updated to match new `CHANNELS` export name.

### Completion Notes List

- **Task 1**: Implemented Zod config schema in `src/shared/config-schema.ts` with all 10 v1 fields, range validators, defaults, exported `configSchema`, `Config` type, and `configDefaults`. 14 tests pass.
- **Task 2**: Defined `CHANNELS` constant in `src/shared/channels.ts` with config, terminal, window, and app channel groups using `domain:action` convention and `as const`. Updated existing tests + added channel convention test. 8 tests pass.
- **Task 3**: Created `src/main/config-store.ts` with `createConfigStore()` factory. Loads config via electron-store, validates with `safeParse()`, field-level fallback to defaults for invalid values, scoped logging, and `get()`/`set()`/`getAll()` API. 9 tests pass.
- **Task 4**: Created `src/main/ipc-handlers.ts` as single IPC registration point. Registers `config:get-all`, `config:set`, `config:get` handlers with try/catch and scoped logging. Wired into `src/main/index.ts` on app ready.
- **Task 5**: Updated `src/preload/index.ts` to expose `config.getAll()` and `config.set()` via wrapped `ipcRenderer.invoke()` calls. Updated `src/shared/ipc-types.ts` with `QuakeShellConfigAPI` interface.
- **Task 6**: All tests written and co-located. `src/shared/config-schema.test.ts` (14 tests), `src/main/config-store.test.ts` (9 tests), `src/shared/shared.test.ts` (8 tests). 31 total tests pass, 0 regressions.

### File List

**Created:**
- src/shared/config-schema.test.ts
- src/main/config-store.ts
- src/main/config-store.test.ts
- src/main/ipc-handlers.ts

**Modified:**
- src/shared/config-schema.ts
- src/shared/channels.ts
- src/shared/config-types.ts
- src/shared/ipc-types.ts
- src/shared/shared.test.ts
- src/main/index.ts
- src/preload/index.ts

### Change Log

- 2026-03-31: Implemented Story 1.2 — Configuration System with Schema Validation. Created Zod config schema with 10 fields, config-store with electron-store persistence and validation, IPC handlers, preload contextBridge config API, and 31 unit tests.
