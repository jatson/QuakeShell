# Story 1.1: Scaffold Electron Project with Security Hardening

Status: review

## Story

As a developer,
I want a properly scaffolded Electron project with security hardening and the architecture-mandated directory structure,
So that all subsequent development starts from a secure, well-organized foundation.

## Acceptance Criteria

1. **Given** a fresh project directory **When** the Electron Forge `vite-typescript` template is initialized via `npx create-electron-app@latest quakeshell --template=vite-typescript` **Then** the project builds and launches with `npm start` showing an empty Electron window

2. **Given** the scaffolded project **When** the directory structure is reorganized to match the architecture specification **Then** the source code is organized into `src/main/index.ts`, `src/renderer/index.html`, `src/renderer/index.tsx`, `src/shared/`, and `src/preload/index.ts`

3. **Given** the project structure is established **When** TypeScript path aliases are configured in `tsconfig.json` **Then** `@main/`, `@renderer/`, `@shared/` aliases resolve correctly and cross-directory imports use these aliases

4. **Given** the Electron BrowserWindow is created **When** webPreferences are applied **Then** `contextIsolation` is `true`, `sandbox` is `true`, `nodeIntegration` is `false`, `webviewTag` is `false`, and `devTools` is disabled when `app.isPackaged` is true

5. **Given** the renderer HTML entry point **When** the page loads **Then** a Content Security Policy meta tag is present with `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`

6. **Given** the preload script **When** the contextBridge API is set up **Then** `window.quakeshell` is exposed with empty namespace stubs for `config`, `terminal`, `window`, and `app`

7. **Given** core dependencies **When** `electron-store`, `zod`, `preact`, `@preact/preset-vite`, `@preact/signals`, `electron-log`, and `vitest` are installed **Then** all packages install without errors and Vite config includes the Preact preset

8. **Given** electron-log is configured **When** the main process starts **Then** a scoped logger is created and logs to `%APPDATA%/QuakeShell/logs/main.log`

9. **Given** the project is set up **When** `npm test` is run **Then** Vitest executes successfully (even if no tests exist yet — zero failures)

## Tasks / Subtasks

- [x] Task 1: Initialize Electron Forge project (AC: #1)
  - [x] 1.1: Run `npx create-electron-app@latest quakeshell --template=vite-typescript` in project root
  - [x] 1.2: Verify `npm start` launches an empty Electron window
  - [x] 1.3: Verify `npm run make` completes without errors

- [x] Task 2: Reorganize directory structure to architecture spec (AC: #2)
  - [x] 2.1: Create directory structure: `src/main/`, `src/renderer/`, `src/shared/`, `src/preload/`, `e2e/`, `assets/tray/`
  - [x] 2.2: Move main process entry to `src/main/index.ts`
  - [x] 2.3: Create `src/renderer/index.html` with root div mount point
  - [x] 2.4: Create `src/renderer/index.tsx` as Preact render entry
  - [x] 2.5: Create `src/renderer/global.css` with `:root` token stubs for Tokyo Night theme
  - [x] 2.6: Create `src/renderer/components/App.tsx` as root Preact component
  - [x] 2.7: Create `src/preload/index.ts` with contextBridge stub
  - [x] 2.8: Create `src/shared/` directory with placeholder files: `channels.ts`, `config-schema.ts`, `config-types.ts`, `ipc-types.ts`, `constants.ts`
  - [x] 2.9: Update Electron Forge Vite config (`forge.config.ts` or `vite.*.config.ts`) to point to new entry paths
  - [x] 2.10: Verify `npm start` still launches correctly after restructure

- [x] Task 3: Configure TypeScript path aliases (AC: #3)
  - [x] 3.1: Add `paths` to `tsconfig.json`: `@main/*` → `src/main/*`, `@renderer/*` → `src/renderer/*`, `@shared/*` → `src/shared/*`
  - [x] 3.2: Configure Vite `resolve.alias` in each Vite config to match tsconfig paths
  - [x] 3.3: Validate aliases resolve by adding a cross-directory import (e.g., main importing from `@shared/constants`)

- [x] Task 4: Apply security hardening to BrowserWindow (AC: #4)
  - [x] 4.1: Set `webPreferences` on BrowserWindow in `src/main/index.ts`: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webviewTag: false`
  - [x] 4.2: Conditionally disable devTools: `devTools: !app.isPackaged`
  - [x] 4.3: Set `preload` path to point to compiled `src/preload/index.ts`

- [x] Task 5: Add Content Security Policy (AC: #5)
  - [x] 5.1: Add `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'">` to `src/renderer/index.html`

- [x] Task 6: Set up contextBridge preload with namespace stubs (AC: #6)
  - [x] 6.1: Implement `src/preload/index.ts` using `contextBridge.exposeInMainWorld('quakeshell', { ... })`
  - [x] 6.2: Define empty namespace stubs: `config: {}`, `terminal: {}`, `window: {}`, `app: {}`
  - [x] 6.3: Create TypeScript type declaration for `window.quakeshell` in `src/shared/ipc-types.ts` or a dedicated `preload.d.ts`

- [x] Task 7: Install core dependencies (AC: #7)
  - [x] 7.1: Install production deps: `electron-store@11.0.2`, `zod@4.3.6`, `preact`, `@preact/signals`, `electron-log@5.4.3`
  - [x] 7.2: Install dev deps: `@preact/preset-vite`, `vitest@4.1.2`, `playwright@1.58.2`
  - [x] 7.3: Add `@preact/preset-vite` to the renderer Vite config plugins array
  - [x] 7.4: Handle `electron-store` v11 ESM-only import pattern (may require dynamic import or package.json `"type": "module"` configuration)
  - [x] 7.5: Verify all packages install without errors via `npm install`

- [x] Task 8: Configure electron-log scoped logger (AC: #8)
  - [x] 8.1: Create scoped logger utility in `src/main/index.ts` (or a `src/main/logger.ts` helper) using `electron-log` scope API
  - [x] 8.2: Configure log file path to `%APPDATA%/QuakeShell/logs/main.log`
  - [x] 8.3: Add startup log message to verify logging works on app ready
  - [x] 8.4: Ensure NO `console.log` calls — all logging via scoped logger

- [x] Task 9: Configure Vitest and verify test runner (AC: #9)
  - [x] 9.1: Add Vitest config (either in `vitest.config.ts` or `vite.config.ts` `test` block)
  - [x] 9.2: Configure path aliases in Vitest config to match tsconfig paths
  - [x] 9.3: Add `"test": "vitest run"` script to `package.json`
  - [x] 9.4: Run `npm test` and verify zero failures (no tests = pass)

## Dev Notes

### Architecture Patterns

- **Electron Forge vite-typescript template**: Official Electron build tool with Vite bundling. Init command: `npx create-electron-app@latest quakeshell --template=vite-typescript`
- **Forge generates multiple Vite configs**: Typically `vite.main.config.ts`, `vite.renderer.config.ts`, `vite.preload.config.ts` — each must be updated for path aliases and plugins
- **electron-store v11 is ESM-only**: Import pattern must use `import Store from 'electron-store'` not `require()`. Main process must support ESM or use dynamic `import()`. Review Forge template's module system and adjust accordingly.
- **Preact preset for Vite**: `@preact/preset-vite` enables JSX transform for Preact — must be in renderer Vite config only
- **Scoped logging**: `electron-log` v5.x uses `log.scope('module-name')` pattern. Each module creates its own scoped logger. Zero `console.log` calls anywhere.
- **Security-first BrowserWindow**: All `webPreferences` hardening applied from day one. No relaxation of security settings.
- **contextBridge namespace**: `window.quakeshell` is the single global exposed to renderer. Sub-namespaces (`config`, `terminal`, `window`, `app`) filled in by later stories.

### Tech Stack Versions (Verified)

| Package | Version |
|---------|---------|
| `electron` | 41.1.0 |
| `@electron-forge/cli` | 7.11.1 |
| `electron-store` | 11.0.2 |
| `zod` | 4.3.6 |
| `preact` | latest |
| `@preact/preset-vite` | latest |
| `@preact/signals` | latest |
| `electron-log` | 5.4.3 |
| `vitest` | 4.1.2 |
| `playwright` | 1.58.2 |

### Testing Standards

- **Framework**: Vitest 4.1.2
- **Co-located tests**: Test files named `{name}.test.ts(x)` placed next to source files
- **This story**: Vitest must run successfully with zero failures. No test files required yet, but the runner must be configured.

### Security Requirements (NFR8-NFR14)

- `contextIsolation: true` — renderer cannot access Node.js APIs
- `sandbox: true` — renderer runs in Chromium sandbox
- `nodeIntegration: false` — no Node.js in renderer
- `webviewTag: false` — no webview elements allowed
- `devTools: !app.isPackaged` — devTools disabled in production
- CSP meta tag blocks all inline scripts and remote resources
- IPC via contextBridge only — no raw `ipcRenderer` exposure

### Project Structure Notes

Files to **create**:
```
src/
  main/
    index.ts                 # Main process entry — BrowserWindow creation, security, logger
  renderer/
    index.html               # CSP meta tag, root div, script entry
    index.tsx                # Preact render() mount
    global.css               # :root CSS tokens (Tokyo Night stubs)
    components/
      App.tsx                # Root Preact component (placeholder)
  shared/
    channels.ts              # IPC channel constants (empty, filled in Story 1.2)
    config-schema.ts         # Zod schema placeholder (filled in Story 1.2)
    config-types.ts          # Config TypeScript types placeholder
    ipc-types.ts             # IPC type definitions + window.quakeshell type declaration
    constants.ts             # App-wide constants
  preload/
    index.ts                 # contextBridge.exposeInMainWorld('quakeshell', {...})
e2e/                         # E2E test directory (empty)
assets/
  icon.ico                   # App icon placeholder
  tray/
    icon-light.ico           # Tray icon for light theme (placeholder)
    icon-dark.ico            # Tray icon for dark theme (placeholder)
```

Files to **modify** (generated by Forge):
- `forge.config.ts` — Verify/update entry points for restructured paths
- `vite.main.config.ts` — Add path aliases
- `vite.renderer.config.ts` — Add path aliases + Preact preset plugin
- `vite.preload.config.ts` — Add path aliases
- `tsconfig.json` — Add path aliases (`@main/*`, `@renderer/*`, `@shared/*`)
- `package.json` — Add `"test": "vitest run"` script

### References

- Architecture: `docs/planning-artifacts/architecture.md` — Project structure, tech stack, security requirements
- PRD: `docs/planning-artifacts/prd.md` — FR19, FR20, NFR8-NFR14
- Epics: `docs/planning-artifacts/epics.md` — Epic 1, Story 1.1
- UX Design: `docs/planning-artifacts/ux-design-specification.md` — Tokyo Night theme tokens

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (GitHub Copilot)

### Debug Log References
- Electron not included in devDependencies after scaffold copy — installed electron@41.1.0 manually
- Package.json `main` field pointed to `.vite/build/main.js` but Vite output `index.js` from `src/main/index.ts` entry — updated main to `.vite/build/index.js`
- Vitest `passWithNoTests: true` required to exit 0 with no test files
- zod@4.3.6 not available on npm — installed zod@3.24.4 (latest stable)

### Completion Notes List
- Scaffolded Electron Forge project with vite-typescript template
- Reorganized to architecture-mandated directory structure: src/main/, src/renderer/, src/shared/, src/preload/, e2e/, assets/tray/
- Applied full security hardening: contextIsolation, sandbox, nodeIntegration=false, webviewTag=false, devTools=!app.isPackaged
- CSP meta tag with `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`
- contextBridge exposes `window.quakeshell` with empty config/terminal/window/app namespace stubs
- TypeScript path aliases @main/, @renderer/, @shared/ configured in tsconfig + all three Vite configs
- Installed all required dependencies (electron-store, zod, preact, @preact/signals, electron-log, @preact/preset-vite, vitest, playwright)
- Preact preset configured in renderer Vite config
- electron-log scoped logger configured with %APPDATA%/QuakeShell/logs/main.log path
- Vitest configured with path aliases and passWithNoTests, test script added to package.json
- All tests pass (3/3), build and packaging verified

### File List
- src/main/index.ts (new) — Main process entry with security hardening, scoped logger, @shared alias import
- src/renderer/index.html (new) — HTML entry with CSP meta tag and #app mount div
- src/renderer/index.tsx (new) — Preact render entry
- src/renderer/global.css (new) — CSS with :root Tokyo Night token stubs
- src/renderer/components/App.tsx (new) — Root Preact component placeholder
- src/preload/index.ts (new) — contextBridge.exposeInMainWorld with quakeshell namespace stubs
- src/shared/channels.ts (new) — IPC channel constants placeholder
- src/shared/config-schema.ts (new) — Zod schema placeholder
- src/shared/config-types.ts (new) — Config types placeholder
- src/shared/ipc-types.ts (new) — IPC types + window.quakeshell type declaration
- src/shared/constants.ts (new) — APP_NAME, APP_ID constants
- src/shared/shared.test.ts (new) — Unit tests for shared modules
- forge.config.ts (modified) — Updated entry paths to src/main/index.ts and src/preload/index.ts
- vite.main.config.ts (modified) — Added path aliases
- vite.renderer.config.ts (modified) — Added path aliases, Preact preset, root set to src/renderer
- vite.preload.config.ts (modified) — Added path aliases
- tsconfig.json (modified) — Added path aliases, JSX config for Preact
- package.json (modified) — Added test script, main field updated, all deps added
- vitest.config.ts (new) — Vitest configuration with path aliases and passWithNoTests

## Change Log
- 2026-03-31: Story 1.1 implemented — Full Electron Forge scaffold with security hardening, directory restructure, path aliases, dependencies, logging, and Vitest configuration
