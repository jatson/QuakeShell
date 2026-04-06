---
stepsCompleted: [step-01-requirements-extracted, step-02-epics-designed, step-03-stories-created]
inputDocuments:
  - docs/planning-artifacts/prd.md
  - docs/planning-artifacts/architecture.md
  - docs/planning-artifacts/ux-design-specification.md
---

# QuakeShell - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for QuakeShell, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: User can spawn a terminal session running PowerShell (latest) as the default shell
FR2: User can spawn a terminal session running a WSL distribution shell
FR3: User can type commands and see output rendered with GPU-accelerated terminal rendering (xterm.js WebGL)
FR4: User can scroll through terminal scrollback buffer
FR5: User can copy text from the terminal to the system clipboard
FR6: User can paste text from the system clipboard into the terminal
FR7: System preserves terminal state (scrollback, running processes, working directory) across show/hide cycles
FR8: User can toggle the terminal window visible/hidden via a global keyboard shortcut
FR9: System slides the terminal window down from the top of the screen with animation when shown
FR10: System slides the terminal window up and hides it with animation when dismissed
FR11: User can adjust the terminal window opacity while it is visible
FR12: System hides the terminal window when it loses focus (focus-fade), if enabled by user
FR13: System displays the terminal as a frameless, borderless, always-on-top window with no taskbar presence
FR14: User can configure which keyboard shortcut toggles the terminal
FR15: User can configure the default shell (PowerShell or WSL)
FR16: User can configure terminal opacity level
FR17: User can enable or disable focus-fade behavior
FR18: User can configure animation speed
FR19: System persists all configuration to disk and loads it on startup
FR20: System validates configuration against a defined schema on load
FR21: System displays an icon in the Windows system tray while running
FR22: User can toggle the terminal by left-clicking the tray icon
FR23: User can access a context menu by right-clicking the tray icon
FR24: Tray context menu provides access to: Settings, Check for Updates, Quit
FR25: User can remap the global hotkey through a settings interface
FR26: System detects and warns when the configured hotkey may conflict with another application
FR27: System gracefully handles hotkey registration failure (shows notification, falls back to tray toggle)
FR28: System can send Windows toast notifications for terminal events (e.g., background process requests user input, long-running command completes)
FR29: User can interact with a notification to bring the terminal into view
FR30: System starts silently on Windows login with no visible window or tray balloon
FR31: User can enable or disable Windows autostart from settings
FR32: System enforces single instance — launching a second instance focuses the existing one
FR33: System checks for available updates periodically and prompts the user via tray notification
FR34: User can trigger an update check manually from the tray context menu
FR35: System displays a first-run experience on initial launch that teaches the hotkey and offers basic configuration
FR36: User can set default shell, hotkey, opacity, and focus-fade during first-run onboarding
FR37: User can dismiss the first-run experience and access settings later

### NonFunctional Requirements

NFR1: Hotkey-to-visible toggle completes in <100ms (measured from keypress to first painted frame)
NFR2: Slide animation runs at 60fps with no dropped frames on integrated GPUs (Intel UHD 620+)
NFR3: Terminal input-to-render latency is <16ms (one frame at 60fps) for typed characters
NFR4: Idle memory usage (terminal hidden) is <80 MB RAM
NFR5: Active memory usage (terminal visible, shell running) is <150 MB RAM
NFR6: Application cold start (boot to tray-ready) completes in <3 seconds
NFR7: Application does not cause perceptible battery drain when idle on laptops
NFR8: Main process and renderer process are isolated via Electron context isolation (contextBridge)
NFR9: Renderer process runs in sandboxed mode
NFR10: Content Security Policy blocks all inline scripts and remote resource loading
NFR11: IPC surface is limited to explicitly defined channels only (no wildcard listeners)
NFR12: No user data is transmitted over the network (fully local operation)
NFR13: Production builds apply @electron/fuses to disable debugging and remote code loading
NFR14: Configuration files are stored with user-only file permissions
NFR15: Application crash rate is <1% per user session
NFR16: Terminal state (scrollback, processes) survives application show/hide cycles with zero data loss
NFR17: Application recovers gracefully from shell process crashes (restarts shell, notifies user)
NFR18: Single instance lock prevents data corruption from duplicate processes
NFR19: Configuration file corruption is detected and falls back to defaults with user notification
NFR20: First-time user can complete install → first toggle in <30 seconds
NFR21: All core functionality is accessible via keyboard (no mouse required)
NFR22: Settings changes take effect immediately without application restart (except shell change)
NFR23: Tray icon and notifications follow Windows system theme (light/dark)

### Additional Requirements

**Starter Template (impacts Epic 1 Story 1):**
- Architecture specifies Electron Forge `vite-typescript` template. Initialization command: `npx create-electron-app@latest quakeshell --template=vite-typescript`
- Project structure follows architecture-defined directory layout: `src/main/`, `src/renderer/`, `src/shared/`, `src/preload/`, `e2e/`, `assets/`

**Dependencies to integrate:**
- node-pty (native module) — requires @electron/rebuild configuration in Forge config
- @xterm/xterm + @xterm/addon-fit + @xterm/addon-webgl + @xterm/addon-web-links — terminal rendering
- electron-store v11 (ESM-only) — config persistence with JSON schema
- Zod 4.3.6 — config schema validation with safeParse + type inference
- @preact/preset-vite + preact (~4KB) — renderer UI framework for non-terminal chrome
- @preact/signals (~1KB) — fine-grained reactivity for renderer state
- electron-log 5.4.3 — scoped logging with file rotation
- Vitest 4.1.2 — unit/integration testing (Vite-native)
- Playwright 1.58.2 — E2E testing with Electron launch support

**Security hardening (NFR8-NFR14):**
- CSP meta tag in index.html: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`
- webPreferences: contextIsolation: true, sandbox: true, nodeIntegration: false, webviewTag: false, devTools: !app.isPackaged
- @electron/fuses applied in production builds
- IPC via contextBridge only — no raw ipcRenderer exposure

**IPC Architecture:**
- Dual-pattern: invoke/handle for renderer→main commands + send/on for main→renderer events
- All channels defined in src/shared/channels.ts — no magic strings
- contextBridge API namespaces: quakeshell.config, quakeshell.terminal, quakeshell.window, quakeshell.app
- Event listeners: onTerminalData, onWindowStateChange, onConfigChange, onNotification

**Implementation patterns (enforced across all stories):**
- Path aliases: @main/, @renderer/, @shared/ via tsconfig paths
- Co-located test files: {name}.test.ts(x) next to source
- Scoped loggers: electron-log scope per module (no console.log)
- Named exports only (except Preact component default exports)
- async/await everywhere, no .then() chains
- ipc-handlers.ts is the single IPC registration point — modules don't touch ipcMain directly
- Error handling: try/catch at IPC handler boundaries, shell crash → auto-restart + notification, config corruption → defaults + notification

**Renderer architecture:**
- Preact components for non-terminal UI (settings, onboarding, notifications)
- @preact/signals with typed sync-layer classes per domain (ConfigStore, WindowStore, TerminalStore)
- CSS Modules (.module.css) + global CSS custom properties for design tokens
- Components read signals from stores, never call IPC directly

**Testing infrastructure:**
- Vitest for unit/integration tests co-located with source
- Playwright for E2E tests in top-level e2e/ folder
- Test critical user journeys: toggle, config persistence, onboarding, shell switching

### UX Design Requirements

UX-DR1: Implement Tokyo Night color system as CSS custom properties — terminal colors defined via xterm.js ITheme: background (#1a1b26), foreground (#c0caf5), cursor (#7aa2f7), selection (#283457), and full ANSI-16 palette (black, red, green, yellow, blue, magenta, cyan, white with bright variants)
UX-DR2: Implement non-terminal chrome color tokens — tab bar background (#13141c), active tab indicator (#7aa2f7), inactive tab text (#565f89), border color (#2a2b3d), UI text (#c0caf5)
UX-DR3: Implement 2px accent-colored (#7aa2f7) bottom edge line at the bottom of the drop-down panel as visual termination and future resize handle target
UX-DR4: Implement Terminal Viewport component — xterm.js container at 100% width, fills available space below tab bar and above resize handle, configurable background opacity (default 85%), 12px horizontal / 8px vertical padding, Cascadia Code 14px default font with fallbacks (Consolas → Courier New → monospace)
UX-DR5: Implement Tab Bar component — 32px height, #13141c background, 1px bottom border, horizontally scrollable when tabs exceed width, contains tab items + new-tab button (+) on left and settings button (⚙) pinned to right
UX-DR6: Implement Tab Item component — 28px height, 4px 12px padding, 4px top border-radius, 80px min-width / 200px max-width, color dot indicator (●), auto-naming (git repo → process → shell → directory), states: default (dimmed text, no bg), active (primary text, terminal bg, 2px accent left border), hover (border bg, × appears), dragging (0.7 opacity, shadow), renaming (inline text input)
UX-DR7: Implement New Tab Button (+) — 28×28px after last tab, --fg-dimmed default / --fg-primary + --border bg on hover, keyboard focusable, aria-label="New tab"
UX-DR8: Implement Settings Button (⚙) — 28×28px right-aligned in tab bar, --fg-dimmed default / --fg-primary on hover with 90° rotation (300ms linear), opens config.json via shell.openPath(), keyboard focusable, aria-label="Open settings"
UX-DR9: Implement Split Divider — 2px visible line with 8px invisible hit area, --border default / --accent on hover and drag, cursor col-resize, draggable to resize panes proportionally, min 20% / max 80% pane width, save proportions on mouseup, role="separator" aria-orientation="vertical"
UX-DR10: Implement Resize Handle — 6px tall full-width bar at bottom of terminal with centered 32×2px grip indicator, --border bg + --fg-dimmed grip default, --accent bg + ns-resize cursor on hover, draggable to adjust height stored as screen percentage, clamped 10%-90%, xterm.js reflow on resize, debounced save on mouseup only, role="separator" aria-orientation="horizontal"
UX-DR11: Implement Onboarding Overlay — rgba(0,0,0,0.7) backdrop with backdrop-filter blur(4px), centered card (max-width 480px, --bg-terminal, 12px border-radius, 40px padding), shows hotkey with physical key cap rendering, quick settings (shell selector, opacity slider, focus-fade toggle), primary CTA "Start Using QuakeShell", dismissible via CTA click / hotkey press / Escape, role="dialog" aria-modal="true"
UX-DR12: Implement Key Cap sub-component — rounded rect, --bg-chrome background, 1px --border, 3px bottom --black-bright depth shadow, Cascadia Code 16px, 8px 14px padding, 6px border-radius
UX-DR13: Implement Settings Row sub-component — flex row with label left / value right, --bg-chrome background, 1px --border, 8px 12px padding, 6px border-radius
UX-DR14: Configure Tray Context Menu items — Toggle Terminal (with Ctrl+Shift+Q shortcut label), Edit Settings (opens config.json), Check for Updates, About QuakeShell, Quit
UX-DR15: Implement slide-down animation (200ms easeOutCubic) for show and slide-up animation (150ms easeInCubic) for hide, using setBounds() from main process with will-change: transform on terminal window
UX-DR16: Implement focus-fade with 300ms grace period delay before hiding — prevents accidental hides from clicking notifications or transient focus loss
UX-DR17: Implement multi-monitor support — terminal appears on active monitor (where focused window is), repositions when user presses hotkey on different monitor, falls back to primary monitor on disconnect
UX-DR18: Implement tab keyboard shortcuts — Ctrl+T (new tab), Ctrl+W (close tab), Ctrl+Tab (next tab), Ctrl+Shift+Tab (previous tab), Ctrl+1-9 (switch by number), Ctrl+Shift+D (split pane) — shell shortcuts (Ctrl+C/D/Z/L/R) never intercepted
UX-DR19: Implement tab auto-naming priority chain — 1) git repo name (when in a git repo), 2) running process name (long-running commands), 3) shell type (PowerShell/WSL/cmd), 4) working directory basename. Manual rename overrides auto-naming until tab is closed
UX-DR20: Implement tab color palette — sequential assignment from palette (blue, green, magenta, yellow, cyan, red), wraps around, user-overridable per tab, color appears as dot in tab + optional subtle tint on terminal
UX-DR21: Implement vertical split pane — max 2 panes per tab in v1, Ctrl+Shift+D to split, each pane is independent terminal session, closing one pane expands remaining to full width, second split attempt in already-split tab is no-op
UX-DR22: Implement mouse-drag resize on bottom edge — 6px handle area, cursor changes to ns-resize on hover, handle highlights with accent color, real-time height update during drag, height saved as percentage of screen on mouseup, clamped to 10%-90%, xterm.js content reflows automatically
UX-DR23: Implement prefers-reduced-motion support — when OS setting active, all animations become instant (0ms duration), includes show/hide slide, settings gear rotation, tab hover transitions
UX-DR24: Implement Windows High Contrast mode support — detect @media (forced-colors: active), override all custom colors to system colors, disable transparency (100% opacity), use bold outline-based focus indicators
UX-DR25: Implement screen reader support — role="tablist" on tab bar, role="tab" with aria-selected and aria-label="Tab N: [name]" on tab items, enable xterm.js accessibility addon at initialization for terminal output announcements
UX-DR26: Implement keyboard focus management — focus moves to active terminal pane on show, focus returns to previously focused window on hide, tab bar items focusable via Tab key, settings and new-tab buttons keyboard-accessible
UX-DR27: Implement shell exit handling — display last output + `[Process exited with code N]` in --fg-dimmed (#565f89), pressing Enter restarts shell in same tab, Ctrl+W closes the tab
UX-DR28: Verify UI at all common Windows DPI scaling levels — 100%, 125%, 150%, 200% — ensure 4px grid scales cleanly and hit areas (6px resize handle, 8px split divider) remain grabbable
UX-DR29: Enforce "hide ≠ close" pattern — hiding terminal never destroys sessions/tabs/scrollback, closing all tabs hides the terminal, next toggle creates a fresh tab, config changes don't kill existing sessions
UX-DR30: Implement config hot-reload — electron-store detects file changes, all JSON config changes (opacity, hotkey, animation speed, focus-fade, font, colors) apply immediately, shell change affects new tabs only (existing tabs keep their shell)

**SCOPE NOTE:** The UX Design Specification includes tabs (Direction 2), split panes (Direction 3), and mouse-drag resize as v1 features. The Architecture document notes a scope discrepancy — PRD scopes v1 as single-terminal, architecture follows PRD scope. This discrepancy should be resolved during epic design (Step 2).

### FR Coverage Map

FR1: Epic 1 - Spawn PowerShell terminal session
FR2: Epic 3 - WSL distribution shell support
FR3: Epic 1 - GPU-accelerated terminal rendering (xterm.js WebGL)
FR4: Epic 1 - Terminal scrollback buffer
FR5: Epic 1 - Copy text to system clipboard
FR6: Epic 1 - Paste text from system clipboard
FR7: Epic 1 - State persistence across show/hide cycles
FR8: Epic 1 - Global hotkey toggle
FR9: Epic 1 - Slide-down animation on show
FR10: Epic 1 - Slide-up animation on hide
FR11: Epic 2 - Adjustable terminal opacity
FR12: Epic 2 - Focus-fade auto-hide
FR13: Epic 1 - Frameless, borderless, always-on-top window
FR14: Epic 2 - Configurable hotkey
FR15: Epic 2 - Configurable default shell
FR16: Epic 2 - Configurable opacity level
FR17: Epic 2 - Configurable focus-fade
FR18: Epic 2 - Configurable animation speed
FR19: Epic 1 - Config persistence to disk with startup load
FR20: Epic 1 - Config schema validation on load
FR21: Epic 1 - System tray icon
FR22: Epic 3 - Tray left-click toggle
FR23: Epic 3 - Tray right-click context menu
FR24: Epic 3 - Tray context menu items (Settings, Updates, Quit)
FR25: Epic 2 - Hotkey remapping via settings
FR26: Epic 2 - Hotkey conflict detection and warning
FR27: Epic 2 - Graceful hotkey registration failure with fallback
FR28: Epic 3 - Windows toast notifications for terminal events
FR29: Epic 3 - Notification interaction brings terminal into view
FR30: Epic 3 - Silent startup on Windows login
FR31: Epic 3 - Configurable Windows autostart
FR32: Epic 3 - Single instance enforcement
FR33: Epic 3 - Periodic update check with tray notification
FR34: Epic 3 - Manual update check from tray menu
FR35: Epic 4 - First-run experience on initial launch
FR36: Epic 4 - Onboarding configuration (shell, hotkey, opacity, focus-fade)
FR37: Epic 4 - Dismissible onboarding with later settings access

**NFR Coverage:**
NFR1-NFR7 (Performance): Epic 1 — addressed in core toggle and rendering implementation
NFR8-NFR14 (Security): Epic 1 — security hardening applied at project foundation
NFR15 (Crash rate): Epic 5 — polish and stability
NFR16 (State persistence): Epic 1 — core show/hide invariant
NFR17 (Shell crash recovery): Epic 3 — lifecycle and error handling
NFR18 (Single instance): Epic 3 — lifecycle
NFR19 (Config corruption): Epic 2 — config system robustness
NFR20 (Onboarding speed): Epic 4 — first-run experience
NFR21 (Keyboard accessible): Epic 5 — accessibility
NFR22 (Live settings): Epic 2 — config hot-reload
NFR23 (System theme): Epic 3 — tray icon theme following

**UX-DR Coverage:**
UX-DR1-DR3 (Design tokens, accent line): Epic 5 — visual polish
UX-DR4 (Terminal Viewport): Epic 1 — core terminal rendering
UX-DR5-DR8 (Tab Bar, Tab Item, New Tab, Settings Button): Phase 2 — deferred per PRD scope
UX-DR9 (Split Divider): Phase 2 — deferred per PRD scope
UX-DR10, DR22 (Resize Handle): Epic 5 — UX polish
UX-DR11-DR13 (Onboarding Overlay, Key Cap, Settings Row): Epic 4 — onboarding
UX-DR14 (Tray Context Menu): Epic 3 — system integration
UX-DR15 (Slide animations): Epic 1 — core toggle
UX-DR16 (Focus-fade grace period): Epic 2 — configuration
UX-DR17 (Multi-monitor): Epic 3 — system integration
UX-DR18 (Tab keyboard shortcuts): Phase 2 — deferred per PRD scope
UX-DR19-DR20 (Tab auto-naming, tab colors): Phase 2 — deferred per PRD scope
UX-DR21 (Split pane): Phase 2 — deferred per PRD scope
UX-DR23-DR25 (Accessibility: reduced motion, high contrast, screen reader): Epic 5
UX-DR26 (Keyboard focus management): Epic 5
UX-DR27 (Shell exit handling): Epic 3 — lifecycle
UX-DR28 (DPI scaling verification): Epic 5
UX-DR29 (Hide ≠ close pattern): Epic 1 — core invariant
UX-DR30 (Config hot-reload): Epic 2 — configuration

## Epic List

### Epic 1: Project Foundation & Core Shell Access
Developer can launch QuakeShell, see it in the system tray, and open a working PowerShell terminal via hotkey with GPU-accelerated rendering. The terminal slides down from the top of the screen with animation, preserves state across show/hide cycles, and persists configuration to disk with schema validation. This is the foundational vertical slice — after this epic, QuakeShell is a usable single-shell drop-down terminal.
**FRs covered:** FR1, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR13, FR19, FR20, FR21
**NFRs addressed:** NFR1-NFR7 (performance), NFR8-NFR14 (security), NFR16 (state persistence)
**UX-DRs addressed:** UX-DR4 (Terminal Viewport), UX-DR15 (slide animations), UX-DR29 (hide ≠ close)

### Epic 2: Configuration & Personalization
Developer can customize QuakeShell to their preferences — adjust opacity, remap the hotkey with conflict detection, set animation speed, toggle focus-fade with grace period, and configure default shell — all via JSON config with immediate hot-reload effect. Config corruption is detected and falls back to defaults with notification.
**FRs covered:** FR11, FR12, FR14, FR15, FR16, FR17, FR18, FR25, FR26, FR27
**NFRs addressed:** NFR19 (config corruption fallback), NFR22 (live settings)
**UX-DRs addressed:** UX-DR16 (focus-fade grace period), UX-DR30 (config hot-reload)

### Epic 3: Application Lifecycle & System Integration
QuakeShell is silently present on every Windows boot, enforces single instance, supports WSL shells, provides tray interactions (left-click toggle, right-click context menu with settings/updates/quit), checks for updates, sends Windows toast notifications for terminal events, handles multi-monitor positioning, and recovers from shell crashes automatically.
**FRs covered:** FR2, FR22, FR23, FR24, FR28, FR29, FR30, FR31, FR32, FR33, FR34
**NFRs addressed:** NFR17 (shell crash recovery), NFR18 (single instance), NFR23 (system theme)
**UX-DRs addressed:** UX-DR14 (tray context menu), UX-DR17 (multi-monitor), UX-DR27 (shell exit handling)

### Epic 4: First-Run Onboarding
New user installs QuakeShell and completes a guided 30-second onboarding that teaches the hotkey with physical key cap rendering, offers essential configuration (shell, opacity, focus-fade), and dismisses permanently — via CTA, hotkey, or Escape. Never shown again after dismissal.
**FRs covered:** FR35, FR36, FR37
**NFRs addressed:** NFR20 (<30s install-to-toggle)
**UX-DRs addressed:** UX-DR11 (Onboarding Overlay), UX-DR12 (Key Cap), UX-DR13 (Settings Row)

### Epic 5: Terminal UX Polish & Accessibility
QuakeShell provides a polished, accessible terminal experience — Tokyo Night design tokens, bottom resize handle for height adjustment, proper keyboard focus management, screen reader support via xterm.js accessibility addon, Windows High Contrast mode support, prefers-reduced-motion compliance, and DPI scaling verification across common Windows scaling levels.
**FRs covered:** (UX-DRs and NFRs — all PRD FRs covered by Epics 1-4)
**NFRs addressed:** NFR15 (crash rate), NFR21 (keyboard accessible)
**UX-DRs addressed:** UX-DR1-DR3 (design tokens), UX-DR10/DR22 (resize handle), UX-DR23-DR25 (accessibility), UX-DR26 (focus management), UX-DR28 (DPI validation)

### Phase 2 (Deferred — Not in v1 Scope)
Tabs, split panes, tab auto-naming, tab color palette, and tab keyboard shortcuts per UX Design Specification directions 2 and 3. Deferred to align with PRD and Architecture single-terminal v1 scope.
**UX-DRs deferred:** UX-DR5-DR9, UX-DR18-DR21

---

## Epic 1: Project Foundation & Core Shell Access

Developer can launch QuakeShell, see it in the system tray, and open a working PowerShell terminal via hotkey with GPU-accelerated rendering. The terminal slides down from the top of the screen with animation, preserves state across show/hide cycles, and persists configuration to disk with schema validation.

### Story 1.1: Scaffold Electron Project with Security Hardening

As a developer,
I want a properly scaffolded Electron project with security hardening and the architecture-mandated directory structure,
So that all subsequent development starts from a secure, well-organized foundation.

**Acceptance Criteria:**

**Given** a fresh project directory
**When** the Electron Forge `vite-typescript` template is initialized via `npx create-electron-app@latest quakeshell --template=vite-typescript`
**Then** the project builds and launches with `npm start` showing an empty Electron window

**Given** the scaffolded project
**When** the directory structure is reorganized to match the architecture specification
**Then** the source code is organized into `src/main/index.ts`, `src/renderer/index.html`, `src/renderer/index.tsx`, `src/shared/`, and `src/preload/index.ts`

**Given** the project structure is established
**When** TypeScript path aliases are configured in `tsconfig.json`
**Then** `@main/`, `@renderer/`, `@shared/` aliases resolve correctly and cross-directory imports use these aliases

**Given** the Electron BrowserWindow is created
**When** webPreferences are applied
**Then** `contextIsolation` is `true`, `sandbox` is `true`, `nodeIntegration` is `false`, `webviewTag` is `false`, and `devTools` is disabled when `app.isPackaged` is true

**Given** the renderer HTML entry point
**When** the page loads
**Then** a Content Security Policy meta tag is present with `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`

**Given** the preload script
**When** the contextBridge API is set up
**Then** `window.quakeshell` is exposed with empty namespace stubs for `config`, `terminal`, `window`, and `app`

**Given** core dependencies
**When** `electron-store`, `zod`, `preact`, `@preact/preset-vite`, `@preact/signals`, `electron-log`, and `vitest` are installed
**Then** all packages install without errors and Vite config includes the Preact preset

**Given** electron-log is configured
**When** the main process starts
**Then** a scoped logger is created and logs to `%APPDATA%/QuakeShell/logs/main.log`

**Given** the project is set up
**When** `npm test` is run
**Then** Vitest executes successfully (even if no tests exist yet — zero failures)

### Story 1.2: Configuration System with Schema Validation

As a developer,
I want a configuration system that persists settings to disk with schema validation and exposes config via IPC,
So that all features can rely on a type-safe, validated configuration that survives restarts.

**Acceptance Criteria:**

**Given** the shared config schema file `src/shared/config-schema.ts`
**When** a Zod schema is defined for the QuakeShell config
**Then** the schema includes all v1 settings with defaults: `hotkey` (default: `"Ctrl+Shift+Q"`), `defaultShell` (default: `"powershell"`), `opacity` (default: `0.85`), `focusFade` (default: `true`), `animationSpeed` (default: `200`), `fontSize` (default: `14`), `fontFamily` (default: `"Cascadia Code, Consolas, Courier New, monospace"`), `dropHeight` (default: `30`), `autostart` (default: `true`), `firstRun` (default: `true`)
**And** `z.infer<>` produces the `Config` TypeScript type used across the codebase

**Given** the IPC channel constants file `src/shared/channels.ts`
**When** channels are defined
**Then** all IPC channel names follow the `domain:action` convention (e.g., `config:get`, `config:set`, `config:get-all`) and are exported as typed constants

**Given** the `src/main/config-store.ts` module
**When** it initializes with electron-store
**Then** the store loads the config file from disk, validates it against the Zod schema using `safeParse()`, and exposes `get(key)`, `set(key, value)`, and `getAll()` methods

**Given** a config file that contains invalid values
**When** `config-store.ts` loads it at startup
**Then** invalid fields fall back to their Zod-defined defaults, a warning is logged via the scoped logger, and the corrected config is saved back to disk

**Given** a config file is missing entirely
**When** `config-store.ts` initializes
**Then** a new config file is created with all Zod default values

**Given** the `src/main/ipc-handlers.ts` module
**When** IPC handlers are registered
**Then** `config:get-all` returns the full config object via `invoke`/`handle`, and `config:set` accepts a key-value pair, validates via Zod, persists to disk, and returns the updated value

**Given** the preload contextBridge
**When** `quakeshell.config` methods are called from the renderer
**Then** `getAll()` returns the full config and `set(key, value)` updates a single config value, both via `invoke`

**Given** config-store is initialized
**When** a unit test validates the Zod schema
**Then** valid configs pass, invalid configs fall back to defaults, and the test file is co-located as `src/main/config-store.test.ts`

### Story 1.3: Terminal Core — PowerShell via node-pty and xterm.js

As a developer,
I want to spawn a PowerShell session in a GPU-accelerated terminal with clipboard support and scrollback,
So that I can type commands, see rendered output, scroll history, and copy/paste text.

**Acceptance Criteria:**

**Given** `node-pty` is installed and Electron Forge is configured with `@electron/rebuild`
**When** the app builds
**Then** `node-pty` compiles against Electron's Node version without errors

**Given** the `src/main/terminal-manager.ts` module
**When** `spawn('powershell')` is called
**Then** a PowerShell process is spawned via `node-pty` using Windows ConPTY, and a scoped logger (`log.scope('terminal')`) logs the spawn event

**Given** a running PTY process
**When** the renderer sends data via `terminal:write` IPC channel
**Then** the data is written to the PTY stdin

**Given** the PTY process produces output
**When** a `data` event fires on the PTY
**Then** the output is sent to the renderer via `webContents.send('terminal:data', { data })` through `ipc-handlers.ts`

**Given** the renderer requests a terminal resize via `terminal:resize` IPC channel
**When** new column and row dimensions are provided
**Then** the PTY process is resized to match and xterm.js reflows content

**Given** the `src/renderer/components/Terminal/TerminalView.tsx` Preact component
**When** it mounts
**Then** an xterm.js `Terminal` instance is created with the WebGL addon for GPU-accelerated rendering, the fit addon for automatic size calculation, and the web-links addon for clickable URLs

**Given** the TerminalView receives data via `onTerminalData` callback
**When** terminal output arrives from the main process
**Then** `xterm.write(data)` renders the output in the terminal viewport

**Given** text is selected in the terminal
**When** the user invokes copy (Ctrl+C with selection, or right-click context)
**Then** the selected text is copied to the system clipboard

**Given** text is in the system clipboard
**When** the user invokes paste (Ctrl+V or right-click paste)
**Then** the clipboard text is written to the terminal input

**Given** the terminal has produced output
**When** the user scrolls up
**Then** the scrollback buffer is navigable and previous output is visible

**Given** the terminal viewport container
**When** it renders
**Then** it fills 100% width with configurable background opacity (reading `opacity` from config), 12px horizontal / 8px vertical padding, and uses the configured font family and size

### Story 1.4: Window Management — Toggle, Animation, and Tray Icon

As a developer,
I want to press a global hotkey to slide the terminal down from the top of the screen and press it again to slide it away,
So that I have instant, always-available terminal access without window management.

**Acceptance Criteria:**

**Given** the `src/main/window-manager.ts` module
**When** it creates the BrowserWindow at app startup
**Then** the window is frameless (`frame: false`), always-on-top (`alwaysOnTop: true`), has no taskbar presence (`skipTaskbar: true`), and is initially hidden (positioned offscreen at `y: -height`)

**Given** the hidden terminal window
**When** the global hotkey (default `Ctrl+Shift+Q`) is pressed
**Then** `window-manager.toggle()` is called, the window slides from `y: -height` to `y: 0` using `setBounds()` animation over 200ms with easeOutCubic easing, and the terminal receives focus

**Given** the visible terminal window
**When** the global hotkey is pressed again
**Then** the window slides from `y: 0` to `y: -height` using `setBounds()` animation over 150ms with easeInCubic easing, and focus returns to the previously focused application

**Given** the animation runs
**When** frames are rendered
**Then** the slide animation maintains 60fps with no dropped frames on integrated GPUs (NFR2)

**Given** the terminal is toggled from hidden to visible
**When** the animation completes
**Then** the total time from keypress to first visible painted frame is <100ms (NFR1) — the window is pre-created, not spawned on demand

**Given** the toggle cycle
**When** the terminal is hidden and then shown again
**Then** terminal state (scrollback, running processes, working directory) is fully preserved — the window is hidden, never destroyed (UX-DR29 hide ≠ close)

**Given** the terminal window dimensions
**When** the window is shown
**Then** it spans 100% of the active monitor's width at the configured `dropHeight` percentage (default 30%) of screen height, positioned at the top edge

**Given** the `src/main/tray-manager.ts` module
**When** the app starts
**Then** a system tray icon is displayed and the app has no taskbar presence

**Given** the `src/main/hotkey-manager.ts` module
**When** it registers the global shortcut on app ready
**Then** it logs success or failure via the scoped logger, and if registration fails, the tray icon remains as a fallback interaction method

**Given** the window state changes
**When** the window becomes visible or hidden
**Then** a `window:state-changed` event is sent to the renderer via IPC with the current visibility state

---

## Epic 2: Configuration & Personalization

Developer can customize QuakeShell to their preferences — adjust opacity, remap the hotkey with conflict detection, set animation speed, toggle focus-fade with grace period, and configure default shell — all via JSON config with immediate hot-reload effect. Config corruption is detected and falls back to defaults with notification.

### Story 2.1: Config Hot-Reload and Live Settings

As a developer,
I want config file changes to apply immediately without restarting QuakeShell,
So that I can edit my JSON config and see results in real-time.

**Acceptance Criteria:**

**Given** the `config-store.ts` module is initialized with electron-store
**When** the config JSON file is modified externally (e.g., saved in VS Code)
**Then** electron-store detects the file change and emits a change event

**Given** a config file change is detected
**When** the new values are read
**Then** each changed key is validated against the Zod schema via `safeParse()` before being applied
**And** invalid values are rejected (last-known-good value kept) and a warning is logged

**Given** a config value changes and passes validation
**When** the change is applied in the main process
**Then** a `config:changed` event is sent to the renderer via `webContents.send()` with `{ key, value, oldValue }` payload

**Given** the renderer receives a `config:changed` event
**When** the `ConfigStore` sync-layer (Preact signals) processes it
**Then** the corresponding signal is updated and all subscribed Preact components re-render with the new value

**Given** the `opacity` config value changes
**When** the renderer receives the update
**Then** the terminal window opacity is updated immediately via `window-manager.setOpacity()` without any visible flicker or restart

**Given** the `animationSpeed` config value changes
**When** the next toggle is triggered
**Then** the slide animation uses the new duration value

**Given** the `fontSize` or `fontFamily` config value changes
**When** the renderer receives the update
**Then** the xterm.js terminal instance updates its font settings and reflows content

### Story 2.2: Opacity Control and Focus-Fade

As a developer,
I want to adjust terminal opacity and enable auto-hide when I click away,
So that I can see content behind the terminal and have it disappear automatically when I'm done.

**Acceptance Criteria:**

**Given** the `opacity` setting in the config (range 0.1 to 1.0, default 0.85)
**When** the terminal window is visible
**Then** the window opacity matches the configured value, applied to the BrowserWindow

**Given** the `opacity` config value is changed via JSON
**When** the hot-reload detects the change
**Then** the terminal window opacity updates immediately with no restart required

**Given** the `focusFade` setting is `true` (default)
**When** the terminal window loses focus (user clicks on another application)
**Then** after a 300ms grace period, the terminal slides up and hides using the standard hide animation

**Given** focus-fade is active and the 300ms grace period is running
**When** the terminal regains focus within 300ms (e.g., user clicked a Windows notification then returned)
**Then** the hide is cancelled and the terminal remains visible

**Given** the `focusFade` setting is `false`
**When** the terminal window loses focus
**Then** the terminal remains visible — only the hotkey or tray click can hide it

**Given** the `focusFade` config value is changed via JSON
**When** the hot-reload detects the change
**Then** the new focus-fade behavior takes effect immediately — if changed from `true` to `false`, the blur listener is removed; if changed from `false` to `true`, the blur listener is added with the 300ms grace period

### Story 2.3: Hotkey Remapping with Conflict Detection

As a developer,
I want to change my global hotkey via JSON config and be warned if it conflicts,
So that I can resolve conflicts with other applications and use my preferred shortcut.

**Acceptance Criteria:**

**Given** the `hotkey` config value is changed in the JSON file
**When** the hot-reload detects the change
**Then** `hotkey-manager.ts` unregisters the old global shortcut and attempts to register the new one

**Given** the new hotkey registration succeeds
**When** `globalShortcut.register()` returns `true`
**Then** the new hotkey is active immediately, the success is logged, and the old hotkey no longer triggers the toggle

**Given** the new hotkey registration fails (conflict with another application)
**When** `globalShortcut.register()` returns `false`
**Then** a warning is logged via the scoped logger with the conflicting hotkey string
**And** the tray icon left-click remains functional as a fallback toggle method
**And** the system does not crash or enter an unusable state

**Given** a hotkey conflict has occurred
**When** the user edits the config again with a different hotkey
**Then** the system attempts registration of the new hotkey on the next hot-reload cycle

**Given** the app starts for the first time
**When** the configured hotkey (default `Ctrl+Shift+Q`) is registered
**Then** if registration fails, the app starts normally with tray-only toggle and logs a warning

### Story 2.4: Shell Selection and Animation Speed

As a developer,
I want to configure my default shell and animation speed via JSON,
So that I can use WSL or a custom shell path and control how fast the terminal slides.

**Acceptance Criteria:**

**Given** the `defaultShell` config value is set to `"powershell"` (default)
**When** a terminal session is spawned
**Then** PowerShell is launched via node-pty

**Given** the `defaultShell` config value is changed to `"wsl"` or a custom path (e.g., `"C:\\Git\\bin\\bash.exe"`)
**When** the hot-reload detects the change
**Then** the existing terminal session is NOT killed (hide ≠ close applies to config changes)
**And** the next time a new session is needed (e.g., after manually closing the current session), the new shell is used

**Given** the `animationSpeed` config value is changed (in milliseconds, default 200)
**When** the next toggle is triggered
**Then** the slide-down animation uses the new value for its duration
**And** the slide-up animation uses a proportionally shorter duration (configured value × 0.75, matching the 200ms/150ms default ratio)

**Given** the `animationSpeed` is set to `0`
**When** the toggle is triggered
**Then** the terminal appears/disappears instantly with no animation (respects user preference for instant mode)

---

## Epic 3: Application Lifecycle & System Integration

QuakeShell is silently present on every Windows boot, enforces single instance, supports WSL shells, provides tray interactions (left-click toggle, right-click context menu with settings/updates/quit), checks for updates, sends Windows toast notifications for terminal events, handles multi-monitor positioning, and recovers from shell crashes automatically.

### Story 3.1: Single Instance Enforcement and Silent Autostart

As a developer,
I want QuakeShell to start silently on Windows boot and prevent duplicate instances,
So that the terminal is always available without me launching it and I never have conflicting instances.

**Acceptance Criteria:**

**Given** the `src/main/app-lifecycle.ts` module
**When** the app starts
**Then** `app.requestSingleInstanceLock()` is called before any other initialization

**Given** the single instance lock is NOT acquired (another instance is running)
**When** the second instance launches
**Then** the second instance sends a signal to the first instance and exits immediately
**And** the first instance's terminal window is brought into view (toggled visible if hidden)

**Given** the single instance lock IS acquired
**When** the app initializes
**Then** startup proceeds normally — tray icon appears, window is pre-created, hotkey is registered

**Given** the `autostart` config value is `true` (default)
**When** the app starts
**Then** `app.setLoginItemSettings({ openAtLogin: true, args: [] })` is called to register Windows autostart

**Given** the `autostart` config value is changed to `false` via JSON config
**When** the hot-reload detects the change
**Then** `app.setLoginItemSettings({ openAtLogin: false })` is called to remove the Windows autostart entry

**Given** the app starts via autostart on Windows login
**When** the startup sequence completes
**Then** no splash screen is shown, no tray balloon appears, no window is visible — only the tray icon is present
**And** the BrowserWindow and shell process are pre-created in the background, ready for the first toggle

**Given** the app starts via autostart
**When** cold start time is measured (boot to tray-ready)
**Then** startup completes in <3 seconds (NFR6)

### Story 3.2: WSL Shell Support

As a developer,
I want to run a WSL distribution shell in QuakeShell,
So that I can use my Linux environment without switching to a separate terminal application.

**Acceptance Criteria:**

**Given** the `defaultShell` config value is set to `"wsl"`
**When** a terminal session is spawned
**Then** `terminal-manager.ts` spawns a WSL shell via node-pty using the `wsl.exe` command

**Given** a WSL shell is running
**When** the user types Linux commands (e.g., `ls`, `cat`, `grep`)
**Then** the commands execute in the default WSL distribution and output renders correctly in xterm.js

**Given** a WSL shell is running
**When** the terminal renders output with ANSI color codes
**Then** colors display correctly through xterm.js (same as PowerShell output rendering)

**Given** WSL is not installed on the system
**When** the app attempts to spawn a WSL shell
**Then** the terminal displays an error message `[Failed to start shell: WSL is not installed or not available]` in dimmed text
**And** the failure is logged via the scoped logger

**Given** the `defaultShell` config accepts custom paths
**When** a value like `"C:\\Git\\bin\\bash.exe"` is configured
**Then** terminal-manager spawns that executable as the shell process

### Story 3.3: Tray Interactions and Context Menu

As a developer,
I want to toggle the terminal by clicking the tray icon and access settings and controls from a right-click menu,
So that I have a fallback when the hotkey doesn't work and quick access to app controls.

**Acceptance Criteria:**

**Given** the tray icon is present in the Windows system tray
**When** the user left-clicks the tray icon
**Then** `window-manager.toggle()` is called, toggling the terminal visible/hidden with the standard slide animation

**Given** the tray icon is present
**When** the user right-clicks the tray icon
**Then** a native context menu appears with the following items in order: Toggle Terminal, Edit Settings, Check for Updates, About QuakeShell, Quit

**Given** the context menu item "Toggle Terminal"
**When** the user clicks it
**Then** the terminal is toggled visible/hidden
**And** the menu item displays the configured hotkey as a shortcut label (e.g., `Ctrl+Shift+Q`)

**Given** the context menu item "Edit Settings"
**When** the user clicks it
**Then** the config JSON file is opened in the user's default `.json` editor via `shell.openPath()`

**Given** the context menu item "Check for Updates"
**When** the user clicks it
**Then** an update check is triggered (same as the periodic check in Story 3.6)

**Given** the context menu item "About QuakeShell"
**When** the user clicks it
**Then** QuakeShell version information is displayed (native Electron about dialog or tray notification)

**Given** the context menu item "Quit"
**When** the user clicks it
**Then** the app performs graceful shutdown: saves current config state, kills all PTY processes cleanly (no orphaned shell processes), closes the window, removes the tray icon, and exits

**Given** the Windows system theme changes between light and dark
**When** the tray icon is rendered
**Then** the appropriate icon variant is displayed (light icon on dark taskbar, dark icon on light taskbar) using the `assets/tray/icon-light.ico` and `assets/tray/icon-dark.ico` assets (NFR23)

### Story 3.4: Shell Crash Recovery and Exit Handling

As a developer,
I want QuakeShell to recover automatically when my shell crashes and show me what happened,
So that I never lose my terminal and can quickly get back to work.

**Acceptance Criteria:**

**Given** a running shell process in the terminal
**When** the shell process exits normally (exit code 0, e.g., user types `exit`)
**Then** the terminal displays the last output followed by `[Process exited with code 0]` in dimmed text (`--fg-dimmed` / `#565f89`)

**Given** a running shell process
**When** the shell process crashes (non-zero exit code)
**Then** the terminal displays the last output followed by `[Process exited with code N]` in dimmed text
**And** the crash is logged via the scoped logger with the exit code and signal

**Given** the terminal is showing a `[Process exited]` message
**When** the user presses Enter
**Then** a new shell process is spawned in the same session using the configured default shell
**And** the terminal is ready for input

**Given** a shell crash occurs
**When** the terminal is currently hidden
**Then** a Windows toast notification is sent: "QuakeShell: Shell process exited unexpectedly"
**And** clicking the notification brings the terminal into view

**Given** the terminal session with an exited shell
**When** the user does not press Enter to restart
**Then** the session remains in its exited state — no auto-restart loop, user controls when to restart

### Story 3.5: Multi-Monitor Support

As a developer,
I want the terminal to appear on whichever monitor I'm currently working on,
So that I never have to look away from my active work to see the terminal.

**Acceptance Criteria:**

**Given** the user is working on a multi-monitor setup
**When** the toggle hotkey is pressed
**Then** `window-manager.ts` determines the active monitor by finding the display containing the currently focused window's position

**Given** the active monitor is identified
**When** the terminal slides down
**Then** it spans 100% of that monitor's width and positions at that monitor's top edge at the configured `dropHeight` percentage of that monitor's height

**Given** the terminal was last shown on Monitor A
**When** the user moves focus to Monitor B and presses the hotkey
**Then** the terminal repositions to Monitor B's top edge before the slide-down animation begins

**Given** the terminal is visible on a monitor
**When** that monitor is disconnected
**Then** the terminal repositions to the primary monitor
**And** the next toggle cycle uses the primary monitor as the active display

**Given** a single-monitor setup
**When** the toggle is triggered
**Then** the terminal always appears on the primary (and only) display — no multi-monitor logic overhead

**Given** monitors with different resolutions or DPI scaling
**When** the terminal repositions between monitors
**Then** the `dropHeight` percentage is recalculated relative to the new monitor's resolution, and the terminal width matches the new monitor's full width

### Story 3.6: Windows Notifications and Update Checking

As a developer,
I want QuakeShell to notify me when a terminal event needs attention and when updates are available,
So that I don't miss important terminal output and can keep QuakeShell up to date.

**Acceptance Criteria:**

**Given** the `src/main/notification-manager.ts` module
**When** a terminal event requires user attention (e.g., a background process requests input while the terminal is hidden)
**Then** a Windows toast notification is displayed with the event description

**Given** a Windows toast notification is displayed
**When** the user clicks the notification
**Then** the terminal is toggled visible (brought into view) and focused

**Given** the terminal is currently visible and focused
**When** a notification-worthy event occurs
**Then** no toast notification is sent — notifications only trigger when the terminal is hidden or unfocused

**Given** the `src/main/app-lifecycle.ts` periodic update check
**When** the app has been running and the check interval elapses (default: every 24 hours)
**Then** the system checks the npm registry for a newer version of the QuakeShell package

**Given** a newer version is found on npm
**When** the update check completes
**Then** a Windows tray notification is displayed: "QuakeShell vX.Y.Z available. Update now?"
**And** the notification does not block or interrupt the user's terminal workflow

**Given** no newer version is found
**When** the update check completes
**Then** nothing visible happens — no notification, no log at info level (only verbose)

**Given** the update check fails (no network, npm registry unreachable)
**When** the check completes with an error
**Then** the failure is logged at verbose level and no error is shown to the user — the app continues operating normally (fully offline capable)

**Given** the user clicks "Check for Updates" from the tray context menu
**When** the manual check runs
**Then** if an update is found, the notification is shown; if no update, a brief tray notification says "QuakeShell is up to date"

---

## Epic 4: First-Run Onboarding

New user installs QuakeShell and completes a guided 30-second onboarding that teaches the hotkey with physical key cap rendering, offers essential configuration (shell, opacity, focus-fade), and dismisses permanently — via CTA, hotkey, or Escape. Never shown again after dismissal.

### Story 4.1: Onboarding Overlay with Hotkey Teaching

As a new user,
I want a first-run overlay that teaches me the hotkey with a visual key cap display and lets me dismiss it easily,
So that I learn the core interaction in seconds and can start using QuakeShell immediately.

**Acceptance Criteria:**

**Given** the `firstRun` config value is `true` (default on fresh install)
**When** the app launches
**Then** the terminal auto-shows at the configured `dropHeight` (default 30%) and the onboarding overlay is displayed on top of the terminal

**Given** the onboarding overlay is displayed
**When** it renders
**Then** it shows a backdrop of `rgba(0,0,0,0.7)` with `backdrop-filter: blur(4px)` covering the terminal
**And** a centered card (max-width 480px, `--bg-terminal` background, 12px border-radius, 40px padding) containing the onboarding content

**Given** the onboarding card
**When** the hotkey section renders
**Then** the configured hotkey (default `Ctrl+Shift+Q`) is displayed using Key Cap sub-components — each key rendered as a rounded rect with `--bg-chrome` background, 1px `--border`, 3px bottom `--black-bright` depth shadow, Cascadia Code 16px font, 8px 14px padding, 6px border-radius
**And** keys are separated by `+` characters between the caps

**Given** the onboarding card
**When** the call-to-action section renders
**Then** a primary CTA button labeled "Start Using QuakeShell" is displayed
**And** a subtitle reads "change anytime from ⚙ or tray"

**Given** the onboarding overlay
**When** the user clicks the "Start Using QuakeShell" CTA button
**Then** the overlay is dismissed permanently and the terminal cursor is active and ready for input

**Given** the onboarding overlay
**When** the user presses the configured hotkey (e.g., `Ctrl+Shift+Q`)
**Then** the overlay is dismissed — the hotkey works during onboarding, teaching through action

**Given** the onboarding overlay
**When** the user presses Escape
**Then** the overlay is dismissed — no trap states, always escapable

**Given** the overlay component
**When** it renders
**Then** it has `role="dialog"`, `aria-modal="true"`, and `aria-label="Welcome to QuakeShell"` for screen reader accessibility

### Story 4.2: Onboarding Quick Settings

As a new user,
I want to configure essential settings during the first-run experience,
So that QuakeShell is personalized to my needs before I start using it.

**Acceptance Criteria:**

**Given** the onboarding overlay card
**When** the quick settings section renders
**Then** three Settings Row sub-components are displayed: Shell selector, Opacity slider, and Focus-fade toggle
**And** each Settings Row is a flex row with label left / value right, `--bg-chrome` background, 1px `--border`, 8px 12px padding, 6px border-radius

**Given** the Shell selector setting row
**When** the user interacts with it
**Then** it offers at minimum "PowerShell" and "WSL" options (WSL only shown if WSL is detected on the system)

**Given** the Opacity slider setting row
**When** the user drags the slider
**Then** the terminal opacity changes in real-time behind the overlay, providing live preview of the selected value

**Given** the Focus-fade toggle setting row
**When** the user toggles it
**Then** the value updates to on/off (default: on)

**Given** the user adjusts settings and then dismisses the overlay (via CTA, hotkey, or Escape)
**When** the dismissal occurs
**Then** all adjusted settings are saved to `config.json` via the config-store
**And** `firstRun` is set to `false` in the config
**And** the settings take effect immediately (opacity already previewed, shell and focus-fade active)

**Given** the app crashes or is force-killed during the onboarding overlay
**When** the app is relaunched
**Then** `firstRun` is still `true` (it was not set to `false` before dismissal) and the onboarding overlay shows again

**Given** `firstRun` is `false` in the config
**When** the app starts
**Then** the onboarding overlay is never shown — the terminal starts normally, hidden and waiting for the hotkey

**Given** the entire onboarding flow (launch → overlay → adjust settings → dismiss → terminal ready)
**When** timed from app start to first usable terminal
**Then** the flow completes in <30 seconds for a user who accepts defaults and clicks the CTA (NFR20)

---

## Epic 5: Terminal UX Polish & Accessibility

QuakeShell provides a polished, accessible terminal experience — Tokyo Night design tokens, bottom resize handle for height adjustment, proper keyboard focus management, screen reader support via xterm.js accessibility addon, Windows High Contrast mode support, prefers-reduced-motion compliance, and DPI scaling verification across common Windows scaling levels.

### Story 5.1: Design Token System — Tokyo Night Colors and CSS Custom Properties

As a developer,
I want a cohesive visual identity with design tokens defined as CSS custom properties,
So that the terminal looks polished and professional with consistent theming across all UI surfaces.

**Acceptance Criteria:**

**Given** the `src/renderer/global.css` file
**When** CSS custom properties are defined in the `:root` block
**Then** the following color tokens are available:
- `--bg-terminal: #1a1b26` (terminal background)
- `--bg-chrome: #13141c` (non-terminal chrome background)
- `--fg-primary: #c0caf5` (primary text)
- `--fg-dimmed: #565f89` (dimmed/inactive text)
- `--accent: #7aa2f7` (accent blue — cursor, active indicators, interactive highlights)
- `--border: #2a2b3d` (subtle structural borders)
- `--red: #f7768e`, `--green: #9ece6a`, `--yellow: #e0af68`, `--blue: #7aa2f7`, `--magenta: #bb9af7`, `--cyan: #7dcfff`
- `--black: #15161e`, `--black-bright: #414868`, `--white: #a9b1d6`, `--white-bright: #c0caf5`

**Given** the xterm.js Terminal instance
**When** it initializes with the ITheme configuration
**Then** the Tokyo Night color scheme is applied: background `#1a1b26`, foreground `#c0caf5`, cursor `#7aa2f7`, selection `#283457`, and the full ANSI-16 palette (black, red, green, yellow, blue, magenta, cyan, white with bright variants)

**Given** the terminal window
**When** it renders
**Then** a 2px accent-colored (`#7aa2f7`) line is visible at the bottom edge of the drop-down panel, providing clean visual termination

**Given** non-terminal chrome elements (onboarding overlay, future settings panel)
**When** they render text
**Then** they use the Segoe UI system font stack (`Segoe UI, -apple-system, sans-serif`) with appropriate sizes: labels at 13px, headings at 18px semibold

**Given** the CSS custom properties
**When** a Preact component uses CSS Modules (`.module.css`)
**Then** component styles reference the global custom properties (e.g., `color: var(--fg-primary)`) for consistent theming

### Story 5.2: Mouse-Drag Resize Handle

As a developer,
I want to drag the bottom edge of the terminal to adjust its height,
So that I can set the terminal size that works best for my workflow without editing config manually.

**Acceptance Criteria:**

**Given** the terminal is visible
**When** the resize handle renders at the bottom edge
**Then** it is a 6px tall full-width bar with a centered 32×2px grip indicator
**And** default styles: `--border` background, grip in `--fg-dimmed`

**Given** the resize handle
**When** the user hovers over it
**Then** the cursor changes to `ns-resize`, the handle background changes to `--accent` color, providing clear visual affordance

**Given** the resize handle
**When** it is rendered
**Then** it has `role="separator"` and `aria-orientation="horizontal"` for accessibility

**Given** the user presses mousedown on the resize handle
**When** they drag vertically
**Then** the terminal height updates in real-time following the mouse Y position
**And** xterm.js reflows its content automatically to fit the new dimensions via the fit addon

**Given** the user is dragging the resize handle
**When** they drag below 10% of screen height
**Then** the height clamps to 10% — the terminal cannot be made smaller

**Given** the user is dragging the resize handle
**When** they drag above 90% of screen height
**Then** the height clamps to 90% — the terminal cannot cover the entire screen

**Given** the user releases the mouse (mouseup) after dragging
**When** the drag ends
**Then** the final height is calculated as a percentage of the current monitor's screen height
**And** the percentage is saved to `dropHeight` in the config via config-store (debounced — only on mouseup, not during drag)

**Given** the config `dropHeight` is updated
**When** the next toggle shows the terminal
**Then** the terminal opens at the saved height percentage

### Story 5.3: Keyboard Focus Management

As a developer,
I want focus to move correctly between the terminal and my other applications,
So that I never lose my typing context when toggling QuakeShell.

**Acceptance Criteria:**

**Given** the terminal is hidden and the user presses the toggle hotkey
**When** the terminal slides into view
**Then** keyboard focus moves to the terminal's xterm.js instance and the cursor is blinking and ready for input

**Given** the terminal is visible and the user presses the toggle hotkey
**When** the terminal slides out of view
**Then** keyboard focus returns to the application window that was focused before the terminal was shown

**Given** the terminal is shown via tray icon left-click
**When** the terminal becomes visible
**Then** focus moves to the terminal, same as hotkey-triggered show

**Given** focus-fade is enabled and the terminal hides due to blur
**When** the terminal slides away
**Then** focus naturally returns to whatever application the user clicked on (the one that caused the blur)

**Given** all core terminal functionality
**When** a user operates QuakeShell without touching the mouse
**Then** all interactions work: toggle (hotkey), type commands, scroll (keyboard), copy (Ctrl+C with selection), paste (Ctrl+V), dismiss (hotkey) — satisfying NFR21

### Story 5.4: Accessibility — Screen Reader, High Contrast, and Reduced Motion

As a user with accessibility needs,
I want QuakeShell to support screen readers, high contrast mode, and reduced motion preferences,
So that I can use the terminal regardless of visual or motor accessibility requirements.

**Acceptance Criteria:**

**Given** the xterm.js Terminal instance
**When** it initializes
**Then** the xterm.js accessibility addon is enabled, allowing screen readers (NVDA, Narrator) to announce terminal output, and supporting character, word, and line navigation

**Given** the operating system has `prefers-reduced-motion: reduce` enabled
**When** QuakeShell renders animations
**Then** all animations run with 0ms duration — terminal show/hide becomes instant (no slide), settings gear rotation is disabled, hover transitions are instant
**And** the CSS rule `@media (prefers-reduced-motion: reduce) { * { animation-duration: 0ms !important; transition-duration: 0ms !important; } }` is applied in `global.css`

**Given** Windows High Contrast mode is active
**When** QuakeShell renders its UI
**Then** the CSS `@media (forced-colors: active)` override applies: all custom colors are replaced with system colors, transparency is disabled (opacity set to 100%), and bold outline-based focus indicators are used instead of subtle color highlights

**Given** High Contrast mode is active
**When** the terminal is toggled
**Then** the terminal background is fully opaque (no transparency) to ensure maximum readability with system colors

**Given** the terminal UI at 100% Windows DPI scaling (96 DPI)
**When** the interface renders
**Then** all elements display at their designed pixel sizes — 6px resize handle, 2px accent line, 4px grid spacing

**Given** the terminal UI at 125%, 150%, or 200% Windows DPI scaling
**When** the interface renders
**Then** Electron/Chromium applies automatic DPI scaling, the 4px spacing grid scales cleanly (5px, 6px, 8px respectively), and hit areas for the resize handle (6px) remain grabbable at all scale levels

**Given** a screen reader user
**When** the onboarding overlay displays
**Then** the overlay's `role="dialog"`, `aria-modal="true"`, and `aria-label="Welcome to QuakeShell"` attributes are announced, and focus is trapped within the dialog until dismissal
