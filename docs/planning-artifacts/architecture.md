---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-03-31'
inputDocuments:
  - docs/planning-artifacts/prd.md
  - docs/planning-artifacts/product-brief-QuakeShell.md
  - docs/planning-artifacts/product-brief-QuakeShell-distillate.md
  - docs/planning-artifacts/ux-design-specification.md
  - docs/planning-artifacts/research/technical-quake-terminal-windows-research-2026-03-31.md
workflowType: 'architecture'
project_name: 'QuakeShell'
user_name: 'Barna'
date: '2026-03-31'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
37 FRs across 7 categories:
- Terminal Core (FR1-FR7): Shell spawning (PowerShell + WSL), GPU-accelerated rendering via xterm.js WebGL, clipboard integration, state persistence across show/hide cycles
- Window Management (FR8-FR13): Global hotkey toggle, slide animation, opacity control, focus-fade auto-hide, frameless always-on-top borderless window with no taskbar presence
- Configuration (FR14-FR20): Configurable hotkey, default shell, opacity, focus-fade, animation speed; JSON persistence via electron-store with schema validation
- System Tray (FR21-FR24): Tray icon with left-click toggle, right-click context menu (Settings, Updates, Quit)
- Hotkey Management (FR25-FR27): Hotkey remapping, conflict detection/warning, graceful fallback on registration failure
- Notifications (FR28-FR29): Windows toast notifications for terminal events; notification-to-terminal focus
- Application Lifecycle (FR30-FR34): Silent autostart, single instance enforcement, update checking via tray
- Onboarding (FR35-FR37): First-run overlay teaching hotkey + basic config

**Non-Functional Requirements:**
23 NFRs across 4 categories:
- Performance: <100ms toggle latency, 60fps animation, <16ms input-to-render, <80MB idle RAM, <150MB active RAM, <3s cold start
- Security: Context isolation, sandbox, strict CSP, IPC channel minimization, @electron/fuses, no network data transmission, user-only config file permissions
- Reliability: <1% crash rate, zero state loss on show/hide, graceful shell crash recovery, single instance lock, config corruption fallback
- Usability: <30s install-to-toggle, keyboard-only operation, immediate settings effect (except shell change), Windows theme-following tray icon

**Scale & Complexity:**
- Primary domain: Desktop application (Electron, Windows-only)
- Complexity level: Low
- Estimated architectural components: 4 main process modules + renderer UI
- No backend, no database, no API, no multi-tenancy, no regulatory compliance

### Technical Constraints & Dependencies

- **OS constraint:** Windows 10 version 1809+ (ConPTY API requirement)
- **Runtime constraint:** Electron 41+ with Chromium 146 / Node 24
- **Native module constraint:** node-pty requires @electron/rebuild for compilation against Electron's Node version
- **Distribution constraint:** npm primary channel; Electron binary downloaded via postinstall (Puppeteer pattern)
- **Memory budget:** ~80MB idle, ~150MB active — Electron baseline is ~60-100MB, leaving limited headroom
- **Packaging:** Electron Forge with Vite plugin; Squirrel.Windows for installer

### Cross-Cutting Concerns Identified

1. **Configuration hot-reload** — Nearly every feature (opacity, hotkey, focus-fade, animation speed, font, theme, drop height) must react to electron-store changes without restart. Config changes propagate via IPC broadcast from Main to Renderer.
2. **IPC security boundary** — All Main↔Renderer communication passes through contextBridge preload with explicitly typed channels. No wildcard listeners, no raw ipcRenderer exposure. This shapes every feature's implementation pattern.
3. **Window lifecycle (hide vs close)** — The terminal is never destroyed during normal use. Show/hide via setBounds animation. Session state (PTY process, scrollback, working directory) survives all hide operations. This is the core architectural invariant.
4. **Multi-monitor awareness** — Terminal must appear on the active monitor, reposition on monitor change, handle monitor disconnect gracefully. Affects WindowManager positioning logic.
5. **Graceful degradation** — Every failure has a fallback: hotkey conflict → tray click toggle; shell crash → auto-restart + notification; config corruption → defaults + notification; monitor disconnect → primary monitor fallback.

## Starter Template Evaluation

### Primary Technology Domain

Desktop application (Electron) — tray-resident single-window terminal emulator for Windows.

### Starter Options Considered

| Option | Verdict | Rationale |
|--------|---------|----------|
| Electron Forge `vite-typescript` | **Selected** | First-party template, Vite bundling, TypeScript, Forge packaging pipeline, actively maintained |
| Electron Forge `webpack-typescript` | Rejected | Webpack adds unnecessary complexity; Vite is faster and simpler for this project |
| electron-vite (community) | Rejected | Third-party, splits ecosystem from official Forge toolchain |
| Manual Electron + Vite | Rejected | Loses Forge's native module rebuilding, packaging, and distribution automation |

### Selected Starter: Electron Forge `vite-typescript`

**Rationale:** Electron Forge is the official Electron build tool. The `vite-typescript` template provides the fastest dev experience with TypeScript safety. Forge handles the critical pain points for QuakeShell: native module compilation (node-pty), Squirrel.Windows packaging, and distribution pipeline.

**Initialization Command:**

```bash
npx create-electron-app@latest quakeshell --template=vite-typescript
```

**Verified Current Versions (web-searched 2026-03-31):**

| Package | Version | Weekly Downloads |
|---------|---------|------------------|
| `electron` | 41.1.0 | 2.9M |
| `@electron-forge/cli` | 7.11.1 | 517K |
| `node-pty` | 1.1.0 | 1.6M |
| `@xterm/xterm` | 6.0.0 | 1.2M |
| `electron-store` | 11.0.2 | 753K |

### Architectural Decisions Provided by Starter

**Language & Runtime:**
- TypeScript for both main and renderer processes
- Electron 41.x (Node 24 / Chromium 146)
- Separate tsconfig for main and renderer

**Build Tooling:**
- Vite for main and renderer process bundling
- Electron Forge for packaging and distribution
- Squirrel.Windows maker included by default

**Code Organization (scaffold):**
- `src/main.ts` — main process entry
- `src/preload.ts` — context bridge preload
- `src/renderer.ts` + `index.html` — renderer process
- `forge.config.ts` — Forge configuration

**Development Experience:**
- Hot-reload dev server via Vite
- `npm start` to launch development build
- `npm run make` to produce distributable

### What the Starter Does NOT Provide (Must Add)

| Dependency | Purpose | Notes |
|------------|---------|-------|
| `node-pty` | PTY process management | Native module — requires `@electron/rebuild` config in Forge |
| `@xterm/xterm` + addons | Terminal rendering | `@xterm/addon-fit`, `@xterm/addon-webgl`, `@xterm/addon-web-links` |
| `electron-store` | Config persistence | **ESM-only** in v11 — affects import patterns in main process |
| Security hardening | Context isolation, CSP, fuses | Must configure manually: sandbox, CSP meta tag, @electron/fuses |
| Testing framework | Unit and integration tests | Vitest recommended (Vite-native) |
| Linting/formatting | Code quality | ESLint + Prettier (standard Electron community setup) |

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

| # | Decision | Choice | Status |
|---|----------|--------|--------|
| 1 | IPC Architecture | `invoke`/`handle` + `send`/`on` via typed contextBridge | Decided |
| 2 | Electron Security Hardening | Meta tag CSP, full webPreferences lockdown, @electron/fuses | Decided |
| 3 | Renderer UI Approach | Preact (~4KB) for non-terminal chrome | Decided |
| 4 | State Management | `@preact/signals` with typed sync-layer classes | Decided |

**Important Decisions (Shape Architecture):**

| # | Decision | Choice | Status |
|---|----------|--------|--------|
| 5 | Config Schema Validation | Zod 4.3.6 with safeParse + type inference | Decided |
| 6 | CSS/Styling Approach | CSS Modules + global CSS custom properties for design tokens | Decided |
| 7 | Logging Strategy | electron-log 5.4.3 with scoped loggers | Decided |
| 8 | Testing Strategy | Vitest 4.1.2 (unit/integration) + Playwright 1.58.2 (E2E) | Decided |

**Deferred Decisions (Post-MVP):**

| Decision | Rationale for Deferral |
|----------|------------------------|
| Auto-update mechanism | Squirrel.Windows built-in handles v1; electron-updater evaluated in Phase 2 |
| CI/CD pipeline specifics | GitHub Actions workflow details decided at implementation time |
| Crash reporting | Electron crashReporter sufficient for v1; third-party evaluated by adoption volume |
| Plugin/extension architecture | Phase 3 scope |

### Decision 1: IPC Architecture

- **Choice:** Dual-pattern IPC — `invoke`/`handle` for renderer→main commands + `send`/`on` for main→renderer events
- **Rationale:** QuakeShell has a natural split: renderer *requests* things (spawn shell, resize, get config) and main *pushes* things (terminal stdout data, window visibility changes, notification events). Terminal output streaming requires main→renderer push — polling would add latency and waste CPU.
- **contextBridge API shape:**
  - `quakeshell.config` — `get()`, `set(key, val)`, `getAll()` via invoke
  - `quakeshell.terminal` — `spawn(shell)`, `write(data)`, `resize(cols, rows)` via invoke
  - `quakeshell.window` — `toggle()`, `setOpacity(val)` via invoke
  - `quakeshell.app` — `getVersion()`, `checkUpdate()`, `quit()` via invoke
  - `quakeshell.onTerminalData(callback)` — main→renderer event
  - `quakeshell.onWindowStateChange(callback)` — main→renderer event
  - `quakeshell.onConfigChange(callback)` — main→renderer event
  - `quakeshell.onNotification(callback)` — main→renderer event
- **Affects:** Every module — this is the communication backbone

### Decision 2: Electron Security Hardening

- **Choice:** Defense-in-depth — meta tag CSP, strict webPreferences, @electron/fuses in production
- **CSP policy:** `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`
  - `unsafe-inline` for styles required because xterm.js injects inline styles for terminal cell rendering
  - `script-src 'self'` blocks all script injection
  - Zero remote resources loaded
- **webPreferences lockdown:**
  - `contextIsolation: true`
  - `sandbox: true`
  - `nodeIntegration: false`
  - `webviewTag: false`
  - `allowRunningInsecureContent: false`
  - `navigateOnDragDrop: false`
  - `devTools: !app.isPackaged` (disabled in production)
- **Production fuses:** `@electron/fuses` disables debugging, remote code loading, Node.js CLI flags
- **Rationale:** PRD mandates NFR8–NFR14. QuakeShell runs shell processes — security hardening is non-negotiable.
- **Affects:** AppLifecycle (fuses), WindowManager (webPreferences), preload (contextBridge)

### Decision 3: Renderer UI Approach

- **Choice:** Preact (~4KB gzipped) for non-terminal UI chrome
- **Rationale:** v1 settings panel, onboarding overlay, and notifications are manageable with vanilla DOM, but Phase 2 brings tabs (drag-reorder, context menus), theme editor, and extended settings. Phase 3 plugins need a component contract for rendering UI panels. Preact's React-compatible API provides the most widely-known component model at minimal cost. Xterm handles terminal rendering independently.
- **Build integration:** `@preact/preset-vite` — single Vite plugin for JSX transform
- **Affects:** Renderer process, all UI components, plugin API contract (Phase 3)

### Decision 4: State Management

- **Choice:** `@preact/signals` (~1KB) with typed sync-layer classes per domain
- **Pattern:** Main process is source of truth for all persistent state. Renderer mirrors state via IPC events into Preact signals. Sync-layer classes (e.g., `ConfigStore`, `WindowStore`) encapsulate signal creation, IPC listener setup, and write-back via invoke.
- **Rationale:** Signals provide fine-grained reactivity — when terminal output streams in, only the notification badge re-renders, not the entire settings panel. No store library overhead. The sync-layer pattern scales to Phase 2 (TabStore, ThemeStore) and Phase 3 (read-only signal access for plugins) without migration.
- **Affects:** Renderer architecture, all Preact components, future plugin read API

### Decision 5: Config Schema Validation

- **Choice:** Zod 4.3.6 (2KB gzipped, zero dependencies)
- **Rationale:** Single source of truth for runtime validation and TypeScript types via `z.infer<>`. Composable nested schemas scale to hundreds of config keys (terminal, window, hotkeys, theme, plugins). `safeParse()` enables graceful corruption recovery (NFR19): log error, fall back to defaults, notify user. `.default()` on new fields handles version migration automatically — no manual migration scripts for additive changes. Phase 3 plugins register their own Zod schemas for per-plugin config namespaces.
- **Location:** Main process only — zero impact on renderer bundle
- **Affects:** ConfigStore module, electron-store integration, config migration strategy

### Decision 6: CSS/Styling Approach

- **Choice:** CSS Modules (Vite-native, `.module.css` convention) + global CSS custom properties
- **Rationale:** UX spec defines design tokens (Tokyo Night colors, spacing, radii) as CSS custom properties. CSS Modules scope component styles with zero runtime cost. Global `:root` block holds shared tokens. Vite supports CSS Modules out of the box — zero config. Scales to Phase 2 theme system: swap `:root` custom property values to change themes, components re-render with new values. No build dependency, no runtime penalty.
- **Affects:** All Preact components, theme system (Phase 2)

### Decision 7: Logging Strategy

- **Choice:** electron-log 5.4.3
- **Rationale:** Purpose-built for Electron. Writes to OS-standard log path (`%APPDATA%/QuakeShell/logs/main.log`). File rotation, log levels, scoped loggers (e.g., `log.scope('pty')`, `log.scope('hotkey')`). Built-in error handler catches unhandled exceptions. Event logger captures Electron crash/GPU events. Zero dependencies. Users share log files for bug reports — critical for a tray-resident app where console is invisible.
- **Affects:** All main process modules, renderer diagnostics, user support workflow

### Decision 8: Testing Strategy

- **Choice:** Vitest 4.1.2 (unit/integration) + Playwright 1.58.2 (E2E)
- **Vitest rationale:** Vite-native — shares build config, no duplicate transform pipeline. Fast, ESM-first, Jest-compatible API. Tests main process modules (config validation, PTY lifecycle, window state) in isolation.
- **Playwright rationale:** First-class Electron launch support via `_electron.launch()`. Drives the real app: test hotkey registration, window show/hide animation, tray icon interaction, terminal I/O flow. Screenshot comparison for terminal rendering verification.
- **Testing scope:** Unit tests for all main process modules; E2E tests for critical user journeys (toggle, config persistence, onboarding, shell switching).
- **Affects:** CI pipeline, development workflow, all modules

### Decision Impact Analysis

**Implementation Sequence:**

1. Security hardening (Decision 2) — configured at `BrowserWindow` creation, foundational
2. IPC architecture (Decision 1) — contextBridge API shape enables all subsequent module development
3. Config validation (Decision 5) — Zod schemas define the config contract used everywhere
4. Preact + signals setup (Decisions 3–4) — renderer foundation for all UI
5. CSS Modules + tokens (Decision 6) — styling infrastructure
6. Logging (Decision 7) — instrument all modules as they're built
7. Testing (Decision 8) — tests written alongside each module

**Cross-Component Dependencies:**

| Decision | Depends On | Depended By |
|----------|-----------|-------------|
| IPC Architecture | Security (contextBridge requires contextIsolation) | All renderer↔main communication |
| Security | None — foundational | IPC, window creation, production builds |
| Preact | IPC (needs contextBridge API to call) | All UI components, plugin UI (Phase 3) |
| Signals sync-layer | IPC (events) + Preact (signal consumption) | Settings UI, tab bar (Phase 2) |
| Zod config | None — main process only | ConfigStore, electron-store, IPC config channels |
| CSS Modules | Preact (component styles) | Theme system (Phase 2) |
| electron-log | None | All modules (instrumentation) |
| Vitest + Playwright | All modules (test targets) | CI pipeline |

## Implementation Patterns & Consistency Rules

### Naming Patterns

**File Naming:**

| Context | Convention | Example |
|---------|-----------|--------|
| Preact components | `PascalCase.tsx` | `SettingsPanel.tsx`, `OnboardingOverlay.tsx` |
| Main process modules | `kebab-case.ts` | `window-manager.ts`, `terminal-manager.ts` |
| Utilities/helpers | `kebab-case.ts` | `config-schema.ts`, `ipc-channels.ts` |
| CSS Modules | `ComponentName.module.css` | `SettingsPanel.module.css` |
| Test files | `{source}.test.ts(x)` co-located | `window-manager.test.ts`, `SettingsPanel.test.tsx` |
| Type definition files | `kebab-case.ts` | `ipc-types.ts`, `config-types.ts` |
| Constants/enums | `kebab-case.ts` | `channels.ts`, `defaults.ts` |

**Code Naming:**

| Element | Convention | Example |
|---------|-----------|--------|
| Classes | PascalCase | `WindowManager`, `ConfigStore` |
| Functions | camelCase | `toggleWindow()`, `spawnTerminal()` |
| Variables/params | camelCase | `isVisible`, `shellType` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_OPACITY`, `MAX_SCROLLBACK` |
| Interfaces/Types | PascalCase, no `I` prefix | `Config`, `WindowState`, `TerminalOptions` |
| Enums | PascalCase members | `Shell.PowerShell`, `Shell.WSL` |
| CSS Module classes | camelCase | `.settingsRow`, `.opacitySlider` |
| Preact signals | camelCase, no `$` prefix | `opacity`, `isVisible`, `activeShell` |

**IPC Channel Naming:**

| Pattern | Example |
|---------|--------|
| Namespace: `domain:action` | `terminal:spawn`, `terminal:write`, `terminal:resize` |
| Events from main: `domain:event-name` | `terminal:data`, `window:state-changed`, `config:changed` |
| All channels defined in single `src/shared/channels.ts` | No magic strings anywhere |

**Config Key Naming:**

- camelCase in JSON: `focusFade`, `animationSpeed`, `defaultShell`
- Mirrors TypeScript property names exactly (Zod schema ↔ config file ↔ type)

### Structure Patterns

**Test Location:** Co-located with source files. `window-manager.ts` → `window-manager.test.ts` in the same directory. E2E tests in top-level `e2e/` folder.

**Import Style:** Path aliases via `tsconfig.json` paths:

- `@main/` → `src/main/`
- `@renderer/` → `src/renderer/`
- `@shared/` → `src/shared/`
- Relative imports only within the same directory (e.g., `./utils`)

**Module Exports:** Named exports only. No default exports (except Preact components, which use default export for lazy loading compatibility).

### Format Patterns

**IPC Response Format:** Direct return values from `invoke`/`handle`. No wrapper objects.

```typescript
// Good: invoke returns the value directly
const config = await quakeshell.config.getAll(); // returns Config

// Error: handler throws, invoke rejects with error
// Renderer catches with try/catch or .catch()
```

**IPC Event Payload:** Single typed object per event.

```typescript
// Good
onTerminalData({ sessionId: string, data: string })
onConfigChange({ key: string, value: unknown, oldValue: unknown })

// Bad: positional arguments
onTerminalData(sessionId, data)
```

### Communication Patterns

**Logging Conventions:**

| Level | Usage | Example |
|-------|-------|--------|
| `error` | Unrecoverable failures, exceptions | PTY spawn failure, config corruption |
| `warn` | Recoverable issues, degraded behavior | Hotkey conflict, fallback to defaults |
| `info` | Significant lifecycle events | App start, shell spawned, config saved |
| `verbose` | Detailed operational events | Window shown/hidden, resize, focus change |
| `debug` | Development diagnostics only | IPC message payloads, signal updates |

**Scoped loggers:** Every main process module creates a scoped logger:

```typescript
const log = electronLog.scope('window-manager');
log.info('Window toggled', { visible: true });
```

### Process Patterns

**Error Handling:**

- Main process: `try/catch` at IPC handler boundaries. Log error, return/throw structured error to renderer.
- Renderer: `try/catch` around `invoke` calls. Display user-facing notification for actionable errors. Log all errors.
- Never silently swallow errors. Every catch block either re-throws, logs, or notifies.
- Shell crash → auto-restart + user notification (NFR17)
- Config corruption → fall back to defaults + user notification (NFR19)

**Async Patterns:**

- All IPC handlers are `async`. No callback-style IPC.
- `async`/`await` everywhere, no `.then()` chains.
- Cleanup via `AbortController` where needed (e.g., animation cancellation).

### Enforcement Guidelines

**All AI agents MUST:**

1. Check `src/shared/channels.ts` before creating any IPC channel — never invent channel names inline
2. Use the path aliases (`@main/`, `@renderer/`, `@shared/`) for cross-directory imports
3. Create a scoped `electron-log` logger at module level, not use `console.log`
4. Co-locate test files with source, matching the `{name}.test.ts(x)` convention
5. Define all types in `@shared/` when used across process boundaries
6. Use named exports (except Preact component default exports)
7. Follow the IPC pattern: `invoke` for commands, `send`/`on` for events — never mix

**Anti-Patterns (Never Do):**

- ❌ `console.log` in production code — use `electron-log`
- ❌ Magic strings for IPC channels — use `channels.ts` constants
- ❌ `any` type — use `unknown` and narrow, or define proper types
- ❌ Relative imports across `main/` ↔ `renderer/` boundary — use `@shared/`
- ❌ Direct `ipcRenderer.send()`/`ipcRenderer.on()` — only `contextBridge`-exposed API
- ❌ Default exports for non-component modules

## Project Structure & Boundaries

### Requirements → Structure Mapping

| FR Category | Primary Location |
|-------------|------------------|
| Terminal Core (FR1–FR7) | `src/main/terminal-manager.ts` + `src/renderer/components/Terminal/` |
| Window Management (FR8–FR13) | `src/main/window-manager.ts` |
| Configuration (FR14–FR20) | `src/main/config-store.ts` + `src/shared/config-schema.ts` |
| System Tray (FR21–FR24) | `src/main/tray-manager.ts` |
| Hotkey Management (FR25–FR27) | `src/main/hotkey-manager.ts` |
| Notifications (FR28–FR29) | `src/main/notification-manager.ts` |
| App Lifecycle (FR30–FR34) | `src/main/app-lifecycle.ts` |
| Onboarding (FR35–FR37) | `src/renderer/components/Onboarding/` |

### Complete Project Directory Structure

```
quakeshell/
├── .github/
│   └── workflows/
│       └── ci.yml
├── .vscode/
│   ├── extensions.json
│   ├── launch.json
│   └── settings.json
├── e2e/
│   ├── toggle.test.ts
│   ├── onboarding.test.ts
│   ├── config-persistence.test.ts
│   └── playwright.config.ts
├── src/
│   ├── main/
│   │   ├── index.ts                      # Main process entry — app.whenReady, module init
│   │   ├── app-lifecycle.ts               # Single instance, autostart, update check
│   │   ├── app-lifecycle.test.ts
│   │   ├── window-manager.ts              # BrowserWindow create, show/hide, slide animation, opacity
│   │   ├── window-manager.test.ts
│   │   ├── terminal-manager.ts            # node-pty spawn, write, resize, shell restart
│   │   ├── terminal-manager.test.ts
│   │   ├── config-store.ts                # electron-store + Zod validation, get/set, migration
│   │   ├── config-store.test.ts
│   │   ├── hotkey-manager.ts              # globalShortcut register/unregister, conflict detection
│   │   ├── hotkey-manager.test.ts
│   │   ├── tray-manager.ts                # Tray icon, context menu, left-click toggle
│   │   ├── tray-manager.test.ts
│   │   ├── notification-manager.ts        # Windows toast notifications
│   │   ├── notification-manager.test.ts
│   │   └── ipc-handlers.ts               # All ipcMain.handle/on registrations — wires modules to IPC
│   ├── renderer/
│   │   ├── index.html                     # HTML entry — CSP meta tag, root div, script
│   │   ├── index.tsx                      # Preact render(), signal stores init
│   │   ├── global.css                     # :root tokens (Tokyo Night), resets, xterm overrides
│   │   ├── components/
│   │   │   ├── App.tsx                    # Root component — terminal + overlay routing
│   │   │   ├── App.module.css
│   │   │   ├── Terminal/
│   │   │   │   ├── TerminalView.tsx       # xterm.js mount, fit addon, WebGL addon
│   │   │   │   └── TerminalView.module.css
│   │   │   ├── Settings/
│   │   │   │   ├── SettingsPanel.tsx      # Settings overlay — hotkey, shell, opacity, focus-fade
│   │   │   │   ├── SettingsPanel.module.css
│   │   │   │   ├── HotkeyInput.tsx        # Hotkey capture field with conflict warning
│   │   │   │   ├── ShellSelector.tsx       # Shell dropdown (PowerShell / WSL)
│   │   │   │   └── OpacitySlider.tsx       # Opacity range input with live preview
│   │   │   ├── Onboarding/
│   │   │   │   ├── OnboardingOverlay.tsx   # First-run flow — hotkey demo + quick config
│   │   │   │   └── OnboardingOverlay.module.css
│   │   │   └── Notification/
│   │   │       ├── ToastNotification.tsx   # In-app notification toast
│   │   │       └── ToastNotification.module.css
│   │   └── state/
│   │       ├── config-store.ts            # ConfigStore sync-layer (signals + IPC)
│   │       ├── window-store.ts            # WindowStore sync-layer (visibility, dimensions)
│   │       └── terminal-store.ts          # TerminalStore sync-layer (session state)
│   ├── shared/
│   │   ├── channels.ts                    # All IPC channel name constants
│   │   ├── config-schema.ts               # Zod schema + Config type (used by both processes)
│   │   ├── config-types.ts                # Config-related types (Shell enum, etc.)
│   │   ├── ipc-types.ts                   # IPC payload types for all channels
│   │   └── constants.ts                   # App-wide constants (defaults, limits)
│   └── preload/
│       └── index.ts                       # contextBridge.exposeInMainWorld('quakeshell', api)
├── assets/
│   ├── icon.ico                           # Tray icon (Windows ICO)
│   ├── icon.png                           # Tray icon (high-res PNG for notifications)
│   └── tray/
│       ├── icon-light.ico                 # Light theme tray icon
│       └── icon-dark.ico                  # Dark theme tray icon
├── forge.config.ts                        # Electron Forge config — makers, plugins, rebuild
├── vite.main.config.ts                    # Vite config for main process
├── vite.preload.config.ts                 # Vite config for preload script
├── vite.renderer.config.ts                # Vite config for renderer process
├── tsconfig.json                          # Root tsconfig — path aliases, shared settings
├── tsconfig.main.json                     # Main process tsconfig (extends root)
├── tsconfig.renderer.json                 # Renderer process tsconfig (extends root, JSX)
├── vitest.config.ts                       # Vitest configuration
├── package.json
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
├── LICENSE
└── README.md
```

### Architectural Boundaries

**Process Boundary (main ↔ renderer):**

- The ONLY communication path is `contextBridge` via `src/preload/index.ts`
- Renderer NEVER imports from `@main/`. Main NEVER imports from `@renderer/`.
- Shared types and constants live in `@shared/` — the only code imported by both processes.

**Module Boundaries (main process):**

```
app-lifecycle.ts ──→ window-manager.ts ──→ (BrowserWindow)
       │                    │
       ├──→ hotkey-manager.ts ──→ window-manager.toggle()
       ├──→ tray-manager.ts ────→ window-manager.toggle()
       ├──→ config-store.ts ────→ (electron-store on disk)
       └──→ terminal-manager.ts ──→ (node-pty process)
                    │
       notification-manager.ts ─── terminal-manager (process events)

ipc-handlers.ts wires all modules to IPC channels — modules don't call ipcMain directly.
```

**Key boundary rules:**

- Each main process module is a class instantiated by `app-lifecycle.ts`
- Modules communicate via direct method calls (same process), not IPC
- Only `ipc-handlers.ts` touches `ipcMain.handle()` / `webContents.send()`
- `config-store.ts` is the single owner of electron-store — other modules request config through it

**Renderer Boundaries:**

- `state/` stores are the only layer that calls `window.quakeshell.*` (contextBridge API)
- Components read signals from stores, never call IPC directly
- `TerminalView.tsx` owns the xterm.js instance — no other component touches the terminal DOM

### Data Flow

```
User presses hotkey
  → OS → Electron globalShortcut
  → hotkey-manager.ts → window-manager.toggle()
  → window-manager setBounds animation → webContents.send('window:state-changed')
  → preload → renderer onWindowStateChange signal
  → App.tsx re-renders based on visibility signal

User types in terminal
  → TerminalView.tsx onData → window.quakeshell.terminal.write(data)
  → preload → ipcMain.handle('terminal:write')
  → ipc-handlers.ts → terminal-manager.write(data)
  → node-pty writes to ConPTY

Shell produces output
  → node-pty 'data' event → terminal-manager
  → webContents.send('terminal:data', { data })
  → preload → renderer onTerminalData callback
  → TerminalView.tsx → xterm.write(data)
```

### Development Workflow

- `npm start` — Electron Forge launches dev build with Vite HMR for renderer
- `npm test` — Vitest runs all co-located `*.test.ts(x)` files
- `npm run test:e2e` — Playwright launches real Electron app for E2E tests
- `npm run make` — Electron Forge produces Squirrel.Windows installer
- `npm run lint` — ESLint + Prettier check

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**

| Decision Pair | Compatible? | Notes |
|--------------|-------------|-------|
| Electron 41 + node-pty 1.1.0 | ✅ | Both target Node 24; Forge handles native rebuild |
| Electron 41 + Preact | ✅ | Preact renders in Chromium 146; no conflicts |
| Preact + `@preact/signals` | ✅ | First-party integration, same maintainer |
| Vite + Preact + CSS Modules | ✅ | `@preact/preset-vite` handles JSX; Vite supports `.module.css` natively |
| electron-store 11 (ESM) + Electron 41 | ✅ | Electron 41 runs Node 24 which supports ESM natively |
| Zod 4.3 + electron-store | ✅ | Zod validates before/after electron-store reads/writes |
| Vitest + Vite configs | ✅ | Vitest reuses Vite config; shared transform pipeline |
| Playwright + Electron | ✅ | Playwright has `_electron.launch()` API |
| electron-log 5 + Electron 41 | ✅ | v5 requires Electron 13+; well within range |

No contradictions found. All versions are current-generation and interoperable.

**Pattern Consistency:**

- ✅ IPC channel naming (`domain:action`) enforced through `channels.ts` constants — aligns with "no magic strings" rule
- ✅ Scoped loggers match the module-per-file structure (one `log.scope()` per module)
- ✅ Co-located tests match kebab-case file naming for main, PascalCase for renderer components
- ✅ Path aliases (`@main/`, `@renderer/`, `@shared/`) enforce process boundary separation

**Structure Alignment:**

- ✅ `src/shared/` exists as the only cross-process import target
- ✅ `ipc-handlers.ts` is the single IPC registration point — modules don't touch ipcMain
- ✅ `src/preload/index.ts` is the single contextBridge surface
- ✅ `state/` stores encapsulate all IPC calls from renderer components

### Requirements Coverage Validation ✅

**Functional Requirements:**

| FR Category | Covered? | Architecture Support |
|-------------|----------|---------------------|
| FR1–FR7: Terminal Core | ✅ | `terminal-manager.ts` (pty), `TerminalView.tsx` (xterm), signals sync-layer |
| FR8–FR13: Window Management | ✅ | `window-manager.ts` (animation, opacity, focus-fade, frameless always-on-top) |
| FR14–FR20: Configuration | ✅ | `config-store.ts` (electron-store + Zod), `SettingsPanel.tsx`, `config-schema.ts` |
| FR21–FR24: System Tray | ✅ | `tray-manager.ts` (icon, context menu, left-click toggle) |
| FR25–FR27: Hotkey Management | ✅ | `hotkey-manager.ts` (globalShortcut, conflict detection, remap UI) |
| FR28–FR29: Notifications | ✅ | `notification-manager.ts` (Windows toast), `ToastNotification.tsx` (in-app) |
| FR30–FR34: App Lifecycle | ✅ | `app-lifecycle.ts` (single instance, autostart, update check) |
| FR35–FR37: Onboarding | ✅ | `OnboardingOverlay.tsx` (first-run flow) |

**Non-Functional Requirements:**

| NFR | Covered? | How |
|-----|----------|-----|
| NFR1: <100ms toggle | ✅ | Pre-created hidden window; `setBounds()` animation (no DOM recreation) |
| NFR2: 60fps animation | ✅ | `setBounds()` via main process, not CSS animation |
| NFR3: <16ms input latency | ✅ | xterm.js WebGL addon; direct pty write via invoke |
| NFR4–5: RAM targets | ⚠️ | Architecture supports it (lazy loading, single window); requires runtime benchmarking |
| NFR6: <3s cold start | ✅ | Tray-resident, no splash; minimal main process init |
| NFR7: No battery drain | ✅ | No polling, event-driven architecture |
| NFR8–14: Security | ✅ | Decision 2 covers all: CSP, sandbox, context isolation, fuses, IPC surface |
| NFR15: <1% crash rate | ✅ | Error handling patterns, shell restart, config fallback |
| NFR16: State persistence | ✅ | xterm buffer + pty process survive show/hide (window hidden, not destroyed) |
| NFR17: Shell crash recovery | ✅ | terminal-manager detects exit → restart + notification |
| NFR18: Single instance | ✅ | `app-lifecycle.ts` uses `app.requestSingleInstanceLock()` |
| NFR19: Config corruption | ✅ | Zod `safeParse()` → fallback to defaults + notification |
| NFR20: <30s onboarding | ✅ | `OnboardingOverlay.tsx` — hotkey demo + quick config |
| NFR21: Keyboard-accessible | ✅ | Terminal is keyboard-native; settings via hotkey |
| NFR22: Live settings | ✅ | Signals react to config changes immediately |
| NFR23: System theme tray | ✅ | Light/dark tray icons in `assets/tray/` |

### Implementation Readiness Validation ✅

**Decision Completeness:**

- ✅ All 8 decisions documented with verified current versions
- ✅ Implementation patterns comprehensive (naming, structure, format, communication, process)
- ✅ Consistency rules clear with concrete examples and anti-patterns
- ✅ Deferred decisions documented with rationale

**Structure Completeness:**

- ✅ Every source file defined with purpose annotation
- ✅ Module dependency graph documented
- ✅ Process boundaries explicitly enforced
- ✅ Data flow traced for critical paths (toggle, terminal I/O)

### Gap Analysis

**No critical gaps found.**

**Minor observations (non-blocking):**

1. **NFR4–5 (RAM targets):** Architecture doesn't guarantee <80MB/<150MB — that's a runtime measurement. The architecture *supports* low memory (single window, no background tabs in v1), but actual numbers need benchmarking during implementation.
2. **Scope discrepancy (flagged in Step 2):** PRD scopes v1 as single-terminal; UX spec includes tabs/splits. Architecture follows PRD scope (single terminal v1). Multi-tab extends `terminal-manager.ts` to manage multiple PTY sessions + adds `TabBar.tsx` in Phase 2 — no architectural restructuring needed.
3. **ESLint/Prettier configs:** Listed in the tree but specific rulesets not decided. Standard `@electron-toolkit/eslint-config-ts` + Prettier defaults are sufficient — configured at implementation time.

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified (ConPTY, ESM-only electron-store)
- [x] Cross-cutting concerns mapped (5 concerns documented)

**✅ Architectural Decisions**

- [x] Critical decisions documented with verified versions
- [x] Technology stack fully specified (8 decisions)
- [x] Integration patterns defined (IPC dual-pattern, contextBridge API)
- [x] Performance considerations addressed (animation strategy, lazy loading)

**✅ Implementation Patterns**

- [x] Naming conventions established (files, code, IPC, config)
- [x] Structure patterns defined (imports, exports, test location)
- [x] Communication patterns specified (logging levels, IPC payloads)
- [x] Process patterns documented (error handling, async)

**✅ Project Structure**

- [x] Complete directory structure defined (every file)
- [x] Component boundaries established (process, module, renderer)
- [x] Integration points mapped (data flow diagrams)
- [x] Requirements to structure mapping complete (FR→file table)

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

**Confidence Level:** High — all critical decisions made, all FRs mapped, all NFRs addressed, zero dependency conflicts.

**Key Strengths:**

- Clear process boundaries prevent main/renderer coupling
- Single IPC registration point (`ipc-handlers.ts`) makes the API surface auditable
- Typed end-to-end: Zod schema → Config type → IPC types → signal types
- Architecture accommodates Phase 2/3 growth without restructuring

**First Implementation Priority:**

```bash
npx create-electron-app@latest quakeshell --template=vite-typescript
```
