---
stepsCompleted: [1]
inputDocuments:
  - docs/planning-artifacts/prd.md
  - docs/planning-artifacts/architecture-v2.md
  - docs/planning-artifacts/ux-design-specification.md
  - docs/planning-artifacts/epics.md
---

# QuakeShell - Epic Breakdown (Phase 2)

## Overview

This document provides the complete epic and story breakdown for QuakeShell Phase 2, decomposing the Phase 2 requirements from the PRD Post-MVP section, UX Design Specification (v2 directions), and Architecture-v2 decisions into implementable stories.

Phase 2 builds on the fully-shipped v1 codebase. All v1 modules are stable and intact. Phase 2 stories are additive unless explicitly noted as refactors.

## Requirements Inventory

### Functional Requirements

- FR-P2-01: User can create a new terminal tab (Ctrl+T or + button in tab bar)
- FR-P2-02: User can close the active terminal tab (Ctrl+W or × button on tab)
- FR-P2-03: User can switch to the next/previous tab (Ctrl+Tab / Ctrl+Shift+Tab)
- FR-P2-04: User can switch directly to a tab by number (Ctrl+1 through Ctrl+9)
- FR-P2-05: User can click a tab in the tab bar to focus that session
- FR-P2-06: User can double-click a tab to rename it inline (Enter confirms, Escape cancels)
- FR-P2-07: System auto-names tabs using priority chain: git repo name → running process name → shell type → working directory basename
- FR-P2-08: Each tab is assigned a unique color from the configured palette (auto-cycling, wraps around)
- FR-P2-09: Closing the last tab hides the terminal rather than destroying the session (hide ≠ close)
- FR-P2-10: Each tab can be opened with a specific shell type (PowerShell, WSL, cmd, Git Bash, custom path)
- FR-P2-11: User can split the active tab into two vertical panes (Ctrl+Shift+D)
- FR-P2-12: User can drag the split divider to resize panes (20%–80% constraint per pane)
- FR-P2-13: Each split pane is an independent terminal session with its own process and scrollback
- FR-P2-14: Closing one pane in a split expands the remaining pane to full width
- FR-P2-15: A tab supports a maximum of 2 panes (no recursive splitting)
- FR-P2-16: System ships with bundled named themes: Tokyo Night (default), Retro Green, Solarized Dark
- FR-P2-17: User can switch the active theme via Settings GUI with live preview
- FR-P2-18: Theme applies to both xterm.js terminal colors (ITheme) and UI chrome CSS custom properties atomically
- FR-P2-19: User can load community themes by placing JSON files in %APPDATA%/QuakeShell/themes/
- FR-P2-20: Active theme hot-reloads when config changes (no restart required)
- FR-P2-21: User can configure terminal font family, size, and line height via Settings GUI
- FR-P2-22: User can configure terminal window width as a percentage of monitor width (20%–100%, default 100%)
- FR-P2-23: User can configure which monitor the terminal appears on (active, primary, or numeric index)
- FR-P2-24: System provides an in-app Settings GUI overlay accessible via Ctrl+, or the settings button in the tab bar
- FR-P2-25: Settings GUI allows configuring all common settings without editing JSON directly
- FR-P2-26: Settings GUI is dismissible with Escape and does not block the running terminal session behind it
- FR-P2-27: "Edit Config File" button in Settings opens the JSON file in the system default editor (power-user escape hatch preserved)
- FR-P2-28: On Windows 11 22H2+, user can enable acrylic blur as an alternative to flat opacity (opt-in toggle in Settings)
- FR-P2-29: On Windows versions that do not support acrylic, the acrylic toggle is hidden; system falls back to standard opacity
- FR-P2-30: On install, system registers "Open QuakeShell here" in Windows Explorer folder and folder-background context menus
- FR-P2-31: On uninstall, system removes the context menu entry automatically
- FR-P2-32: User can re-register or deregister the context menu entry from Settings without reinstalling
- FR-P2-33: When launched with --cwd <path>, terminal opens a new tab with that working directory
- FR-P2-34: Application is installable via Scoop package manager
- FR-P2-35: Application is installable via Windows Package Manager (Winget)
- FR-P2-36: Existing v1 configuration files load without error, prompts, or data loss after upgrading to Phase 2 (additive config migration)

### NonFunctional Requirements

- NFR-P2-01: Tab creation and switching completes in <16ms (one render frame) — no perceptible lag added by the tab bar
- NFR-P2-02: Multi-tab memory overhead per additional PTY session is <10MB; 10 tabs maximum stays within 180MB total active RAM (extends v1 NFR5)
- NFR-P2-03: Theme switch (xterm.js ITheme + CSS custom property update) completes within one render frame — no visible flash of mis-themed chrome
- NFR-P2-04: Split divider drag updates at 60fps with no input lag (renderer-owned state, no IPC during drag)
- NFR-P2-05: Context menu registration requires no admin elevation (HKCU registry scope; no UAC prompt)
- NFR-P2-06: All Phase 2 config keys hot-reload without application restart (extends v1 NFR22)
- NFR-P2-07: v1 configs silently migrate forward with Zod .default() — no migration code, zero data loss
- NFR-P2-08: Distribution manifests are auto-generated in CI — no manual release process steps added for maintainer
- NFR-P2-09: Settings GUI overlay response time to Ctrl+, press is <100ms (same standard as toggle hotkey)
- NFR-P2-10: Acrylic blur fallback catches all errors silently via electron-log; user never sees an unresponsive or broken terminal

### Additional Requirements

From Architecture-v2 decisions that directly constrain implementation:

- ARCH-P2-01: `TabManager` module owns `Map<tabId, TabSession>` in main process; `TerminalManager` is refactored into a PTY I/O utility called by `TabManager` (Decision P2-1)
- ARCH-P2-02: IPC channel `terminal:data` is renamed to `tab:data` and gains `tabId` in its payload — this is the single intentional breaking change; isolated to one story (Decision P2-1)
- ARCH-P2-03: `TabSession` shape: `{ id: string, shellType: Shell, ptyProcess: IPty, color: TabColor, manualName?: string, splitPaneId?: string }` (Decision P2-1)
- ARCH-P2-04: Split pane layout state is renderer-owned only; main process has no concept of "split" — two independent `TabSession` entries; split ratio is not persisted (restores to 50/50) (Decision P2-4)
- ARCH-P2-05: `ThemeEngine` applies themes on two independent channels synchronously: xterm.js `ITheme` per terminal instance + CSS custom property swap via `ThemeStyleInjector` component (Decision P2-2)
- ARCH-P2-06: Theme definition format: `{ id, name, xtermTheme: ITheme, chromeTokens: { bgTerminal, bgChrome, fgPrimary, fgDimmed, accent, border } }` (Decision P2-2)
- ARCH-P2-07: Community themes loaded from `%APPDATA%/QuakeShell/themes/` directory via `ThemeEngine` file watcher (Decision P2-2)
- ARCH-P2-08: Config schema extended additively with Zod `.default()` — `theme`, `window.widthPercent`, `window.monitor`, `tabs.colorPalette`, `tabs.maxTabs`, `acrylicBlur` all have defaults (Decision P2-3)
- ARCH-P2-09: Settings GUI reuses all existing `quakeshell.config.get/set` IPC channels — no new IPC channels needed for settings reads/writes (Decision P2-5)
- ARCH-P2-10: Acrylic blur uses `os.release()` runtime detection (Win11 = build ≥ 22621); `BrowserWindow.backgroundMaterial: 'acrylic'` Electron 36+ API with `try/catch` fallback to opacity (Decision P2-6)
- ARCH-P2-11: Context menu registration uses `child_process.execSync('reg add ...')` targeting HKCU — no native registry library (Decision P2-7)
- ARCH-P2-12: Squirrel lifecycle hooks in `app-lifecycle.ts` for `--squirrel-install`, `--squirrel-updated`, `--squirrel-uninstall` trigger context menu register/deregister (Decision P2-7)
- ARCH-P2-13: Tab auto-naming uses `child_process.execSync('git rev-parse --show-toplevel')` — no `simple-git` dependency (Decision P2-8)
- ARCH-P2-14: Scoop and Winget manifests are CI-generated artifacts — zero `src/` changes required (Decision P2-9)

### UX Design Requirements

- UX-DR-P2-01: Tab Bar component — 32px height, `--bg-chrome` background, compact horizontal layout with left-to-right tabs, horizontal scroll if tabs overflow (no wrapping)
- UX-DR-P2-02: Tab Item component — 28px height, color dot (●) + name + × button (hover-only); active state: `--fg-primary` text, `--bg-terminal` background, 2px `--accent` left border; default state: `--fg-dimmed` text, no background
- UX-DR-P2-03: New Tab (+) button positioned immediately after last tab; 28×28px click target; `--fg-dimmed` default, `--fg-primary` on hover with `--border` background
- UX-DR-P2-04: Settings Button (⚙) pinned to the right end of Tab Bar; 28×28px; hover triggers 90° rotation animation over 300ms; opens Settings overlay (replaces tray "Edit Settings" for in-app access)
- UX-DR-P2-05: Split Divider component — 2px visible line, invisible 8px hit area for easier grab; `--border` color default, `--accent` color on hover/drag; `col-resize` cursor
- UX-DR-P2-06: Tab drag-to-reorder using native HTML drag-and-drop API (`draggable`, `dragover`, `drop`) — no library; 0.7 opacity + shadow on dragging tab; 2px `--accent` vertical drop indicator between tabs
- UX-DR-P2-07: All tab operations keyboard-accessible: Ctrl+T (new), Ctrl+W (close), Ctrl+Tab (next), Ctrl+Shift+Tab (previous), Ctrl+1–9 (switch by number), Ctrl+Shift+D (split), double-click (rename)
- UX-DR-P2-08: Tab auto-naming priority: git repo basename → running process name → shell type label (pwsh/WSL/cmd/bash) → cwd basename; manual rename overrides until tab is closed
- UX-DR-P2-09: Closing the last tab hides the terminal (hide ≠ close) with no confirmation dialog; next hotkey press creates a fresh tab
- UX-DR-P2-10: Settings GUI overlay — tabs: General, Appearance, Themes, Keyboard, Distribution; Escape dismisses; rendered above terminal (does not block running session); max width 600px, centered in terminal area
- UX-DR-P2-11: Theme selector in Settings shows live preview (both terminal colors and chrome tokens) before user confirms; displays theme name, color swatches
- UX-DR-P2-12: ThemeStyleInjector updates xterm.js ITheme and CSS custom properties atomically before the next frame — no visible flash during theme switch
- UX-DR-P2-13: Tab drag (reorder), split divider drag, and resize handle drag all share the same interaction contract: save state on mouseup only, real-time visual preview during drag, enforce min/max bounds, `will-change: transform` for GPU acceleration
- UX-DR-P2-14: Tab color palette default: `['#7aa2f7','#9ece6a','#bb9af7','#e0af68','#7dcfff','#f7768e']` — auto-cycles; tab identity uses both color AND name (no color-only differentiation — colorblind accessible)
- UX-DR-P2-15: Acrylic blur opt-in in Settings — visible only on Win11 22H2+; hidden on all other OS versions (runtime detection, not static compile flag)
- UX-DR-P2-16: Context menu registration toggle in Settings — shows current status ("Registered" / "Not registered"); re-registers or deregisters on toggle without requiring reinstall
- UX-DR-P2-17: Monitor and window width config exposed in Settings General tab — width as percentage slider (20%–100%), monitor as dropdown (Active Monitor / Primary Monitor / Monitor 1…N)
- UX-DR-P2-18: All new Settings panels include "Edit Config File" link to preserved JSON escape hatch

### FR Coverage Map

| Feature Area | FRs | NFRs | Architecture | UX-DRs | Epic |
|---|---|---|---|---|---|
| Config schema extension | FR-P2-36 | NFR-P2-07 | ARCH-P2-08 | — | Epic 1 |
| IPC refactor (tab:data) | — | — | ARCH-P2-02 | — | Epic 1 |
| TabManager module | FR-P2-01–10 | NFR-P2-01, 02 | ARCH-P2-01, 03 | UX-DR-P2-01–04, 06–09, 14 | Epic 2 |
| Per-tab shell type | FR-P2-10 | — | ARCH-P2-03 | UX-DR-P2-08 | Epic 2 |
| Tab auto-naming | FR-P2-07 | — | ARCH-P2-13 | UX-DR-P2-08 | Epic 2 |
| Split pane | FR-P2-11–15 | NFR-P2-04 | ARCH-P2-04 | UX-DR-P2-05, 07, 13 | Epic 3 |
| Theming engine | FR-P2-16–20 | NFR-P2-03 | ARCH-P2-05, 06, 07 | UX-DR-P2-11, 12 | Epic 4 |
| Font configuration | FR-P2-21 | — | — | UX-DR-P2-10 | Epic 4 |
| Settings GUI overlay | FR-P2-24–27 | NFR-P2-09 | ARCH-P2-09 | UX-DR-P2-10, 18 | Epic 5 |
| Window dimensions + monitor | FR-P2-22–23 | — | ARCH-P2-08 | UX-DR-P2-17 | Epic 5 |
| Acrylic blur | FR-P2-28–29 | NFR-P2-10 | ARCH-P2-10 | UX-DR-P2-15 | Epic 5 |
| Context menu installer | FR-P2-30–33 | NFR-P2-05 | ARCH-P2-11, 12 | UX-DR-P2-16 | Epic 6 |
| Distribution (Scoop/Winget) | FR-P2-34–35 | NFR-P2-08 | ARCH-P2-14 | — | Epic 7 |

## Epic List

1. [Epic 1: Config Schema Extension & IPC Foundation](#epic-1-config-schema-extension--ipc-foundation)
2. [Epic 2: Multi-Tab Session Model](#epic-2-multi-tab-session-model)
3. [Epic 3: Split Pane](#epic-3-split-pane)
4. [Epic 4: Theming Engine](#epic-4-theming-engine)
5. [Epic 5: Settings GUI Overlay](#epic-5-settings-gui-overlay)
6. [Epic 6: Shell Context Menu](#epic-6-shell-context-menu)
7. [Epic 7: Distribution Packaging](#epic-7-distribution-packaging)

---

## Epic 1: Config Schema Extension & IPC Foundation

**Goal:** Extend the v1 config schema to include all Phase 2 configuration keys using additive Zod `.default()` patterns, and perform the single intentional IPC breaking change (renaming `terminal:data` to `tab:data` with `tabId` in payload). This epic is a prerequisite for all other Phase 2 epics.

No user-visible features are delivered — this is pure internal foundation.

### Story 1.1: Extend Config Schema with Phase 2 Keys

As a developer,
I want the config schema to include all Phase 2 keys with safe defaults,
So that existing v1 configs load without error and new Phase 2 features have their configuration fields ready.

**Acceptance Criteria:**

**Given** a v1 user with an existing `config.json` that has no Phase 2 keys  
**When** the app loads and `configStore.get()` is called  
**Then** the v1 config parses successfully with no errors and Phase 2 keys resolve to their Zod defaults

**Given** the updated config schema  
**When** TypeScript compiles the project  
**Then** there are no type errors in `config-schema.ts`, `config-types.ts`, or `config-store.ts`

**Given** the new `theme` config key  
**When** no `theme` value is present in the user's config  
**Then** `theme` defaults to `'tokyo-night'`

**Given** the new `window.widthPercent` key  
**When** no value is present  
**Then** it defaults to `100` (full-width, preserving v1 behaviour)

**Given** the new `window.monitor` key  
**When** no value is present  
**Then** it defaults to `'active'` (preserving v1 multi-monitor follow-active behaviour)

**Given** the new `tabs.colorPalette` key  
**When** no value is present  
**Then** it defaults to `['#7aa2f7','#9ece6a','#bb9af7','#e0af68','#7dcfff','#f7768e']`

**Given** the new `tabs.maxTabs` key  
**When** no value is present  
**Then** it defaults to `10`

**Given** the new `acrylicBlur` key  
**When** no value is present  
**Then** it defaults to `false`

**Given** any invalid value for a new Phase 2 key (e.g., `window.widthPercent: 999`)  
**When** the config is parsed  
**Then** Zod validation rejects it and falls back to the default, logging a warning via electron-log

---

### Story 1.2: Refactor terminal:data IPC to tab:data

As a developer,
I want the `terminal:data` IPC channel renamed to `tab:data` with a `tabId` field in the payload,
So that all terminal data events are scoped to a specific session, enabling the multi-tab architecture.

**Acceptance Criteria:**

**Given** a running terminal session  
**When** the PTY emits output  
**Then** the renderer receives a `tab:data` event with `{ tabId: string, data: string }` payload

**Given** the updated IPC channel  
**When** the renderer sends input to the terminal  
**Then** `terminal:input` is updated to `tab:input` with `{ tabId: string, data: string }` and the correct PTY receives the data

**Given** all IPC channel names  
**When** `src/shared/channels.ts` is inspected  
**Then** `terminal:data` and `terminal:input` no longer exist; `tab:data` and `tab:input` replace them

**Given** the preload bridge  
**When** `src/preload/index.ts` is inspected  
**Then** all contextBridge API references use the new channel names consistently

**Given** the existing single-session v1 behaviour  
**When** there is exactly one tab  
**Then** terminal I/O behaviour is identical to v1 (the refactor is transparent to the user)

**Given** the updated renderer `TerminalView` component  
**When** it subscribes to terminal data  
**Then** it uses `tab:data` and filters events by its own `tabId` prop

---

## Epic 2: Multi-Tab Session Model

**Goal:** Implement full multi-tab terminal sessions — the `TabManager` main-process module, the tab bar UI with all keyboard shortcuts, tab auto-naming, and per-tab shell type selection. Delivers the first visible Phase 2 user experience.

**Depends on:** Epic 1 (config schema + tab:data IPC)

### Story 2.1: TabManager Module

As a developer,
I want a `TabManager` main-process module that owns all terminal sessions in a `Map<tabId, TabSession>`,
So that terminal sessions are keyed by UUID, the active tab is tracked, and `TerminalManager` is used as a PTY utility.

**Acceptance Criteria:**

**Given** the app starts  
**When** `TabManager.init()` is called  
**Then** one default `TabSession` is created using the configured `defaultShell`, assigned a UUID, and stored in the Map

**Given** a `tab:create` IPC call with optional `{ shellType?, cwd? }` options  
**When** handled by `ipc-handlers.ts`  
**Then** `TabManager.createTab(options)` creates a new `TabSession`, adds it to the Map, and returns the full `TabSession` object to the renderer

**Given** a `tab:close` IPC call with `{ tabId }`  
**When** handled  
**Then** the PTY process for that session is killed, the session is removed from the Map, and the renderer receives `tab:closed` with the `tabId`

**Given** a `tab:switch` IPC call with `{ tabId }`  
**When** handled  
**Then** `TabManager.setActiveTab(tabId)` updates `activeTabId` and emits `tab:active-changed` to the renderer

**Given** `src/main/tab-manager.ts` is created  
**When** the module is inspected  
**Then** `TerminalManager` is imported and used for PTY spawn/write/resize/kill operations; no direct `node-pty` calls exist in `tab-manager.ts`

**Given** an attempt to create a tab when `tabs.maxTabs` is reached  
**When** `tab:create` is called  
**Then** the call is rejected with an error reason and no new session is spawned

---

### Story 2.2: Tab Bar UI Component

As a user,
I want a compact 32px tab bar above the terminal showing all open sessions,
So that I can see and switch between my terminal sessions at a glance.

**Acceptance Criteria:**

**Given** two or more tabs exist  
**When** the terminal is visible  
**Then** the tab bar is rendered at the top of the drop-down at exactly 32px height with `--bg-chrome` background

**Given** a tab session  
**When** rendered as a Tab Item  
**Then** the item shows a color dot (●), the tab name, and a × button (× visible only on hover); active tab has `--fg-primary` text and a 2px `--accent` left border

**Given** tabs that exceed the available width  
**When** the tab bar overflows  
**Then** horizontal scrolling is enabled; tabs never wrap to a second row

**Given** a click on a tab item  
**When** the click is processed  
**Then** that tab becomes active and the terminal view switches to that session's PTY output

**Given** a click on the × button of a non-active tab  
**When** processed  
**Then** that tab session is closed without switching focus to it first

**Given** a click on the + button  
**When** processed  
**Then** a new tab is created with the default shell and focus moves to the new tab

**Given** the tab bar  
**When** only one tab exists  
**Then** the tab bar is still visible (single-tab state); the × button does not cause terminal close but triggers hide

**Given** CSS  
**When** the tab bar renders  
**Then** total drop-down height = `window.heightPercent` of screen height, tab bar is 32px, terminal area fills remaining height below the bar

---

### Story 2.3: Tab Keyboard Shortcuts

As a user,
I want browser-style keyboard shortcuts to create, close, and switch tabs,
So that I can manage sessions without touching the mouse.

**Acceptance Criteria:**

**Given** the terminal is visible  
**When** user presses Ctrl+T  
**Then** a new tab is created with the default shell and receives focus

**Given** the terminal is visible with multiple tabs  
**When** user presses Ctrl+W  
**Then** the active tab is closed and focus moves to the adjacent tab (right preferred, left fallback)

**Given** exactly one tab is open  
**When** user presses Ctrl+W  
**Then** the terminal hides (hide ≠ close); the session is preserved; next toggle creates a fresh tab

**Given** multiple tabs  
**When** user presses Ctrl+Tab  
**Then** focus moves to the next tab (right, wraps to first)

**Given** multiple tabs  
**When** user presses Ctrl+Shift+Tab  
**Then** focus moves to the previous tab (left, wraps to last)

**Given** at least N tabs where 1 ≤ N ≤ 9  
**When** user presses Ctrl+N (number key)  
**Then** focus moves directly to the Nth tab; if fewer than N tabs exist, the shortcut is a no-op

**Given** all tab shortcuts  
**When** the terminal input has focus  
**Then** the shortcuts are intercepted by QuakeShell and not passed through to the running shell

---

### Story 2.4: Tab Rename (Inline)

As a user,
I want to double-click a tab to rename it inline,
So that I can give sessions meaningful names that persist for the session lifetime.

**Acceptance Criteria:**

**Given** a tab item  
**When** user double-clicks the tab name area  
**Then** an inline `<input>` replaces the name text, pre-filled with the current name, with all text selected

**Given** the rename input is active  
**When** user presses Enter  
**Then** the manual name is saved to `TabSession.manualName`, auto-naming stops for this session, and the input reverts to a text label

**Given** the rename input is active  
**When** user presses Escape  
**Then** the input reverts to the previous name with no change

**Given** user sets a manual name  
**When** the tab cwd changes (e.g., user `cd`s into a git repo)  
**Then** the manual name is preserved; auto-naming does NOT override it

**Given** a tab with a manual name  
**When** that tab is closed and a new tab is opened  
**Then** the new tab starts fresh with auto-naming (manual name does not persist across sessions)

---

### Story 2.5: Tab Auto-Naming

As a user,
I want new tabs to be named automatically based on my working context,
So that I can identify sessions without manual renaming for most common workflows.

**Acceptance Criteria:**

**Given** a new tab spawns in a directory that is inside a git repository  
**When** auto-naming resolves  
**Then** the tab name is set to the basename of the git repository root (e.g., `QuakeShell`)

**Given** a new tab spawns in a directory that is not a git repo  
**When** auto-naming resolves  
**Then** the tab name falls to the next priority: running process name if a foreground process is detected, otherwise shell type label (`pwsh`, `wsl`, `cmd`, `bash`), otherwise `path.basename(cwd)`

**Given** auto-naming detects a git repo  
**When** `child_process.execSync('git rev-parse --show-toplevel', { cwd })` throws (e.g., no git installed)  
**Then** the error is caught silently and the next fallback priority is used

**Given** the user `cd`s to a different directory within the same tab  
**When** the cwd changes  
**Then** auto-naming re-evaluates within 2 seconds and updates the tab name (if no manual name is set)

**Given** a tab with a manual name  
**When** the cwd changes  
**Then** auto-naming does NOT update the tab name

---

### Story 2.6: Per-Tab Shell Type

As a user,
I want each tab to use its own shell type independently,
So that I can have a PowerShell tab and a WSL tab open simultaneously.

**Acceptance Criteria:**

**Given** a `tab:create` call with `{ shellType: 'wsl' }`  
**When** `TabManager.createTab` is called  
**Then** a WSL PTY is spawned; the tab's `TabSession.shellType` is `'wsl'`

**Given** a `tab:create` call with no `shellType`  
**When** processed  
**Then** the new tab uses `config.defaultShell` as its shell type

**Given** an existing tab with a running PowerShell session  
**When** a second tab is created with `shellType: 'wsl'`  
**Then** the PowerShell session is unaffected; both sessions run concurrently

**Given** config `defaultShell` changes via hot-reload  
**When** existing tabs are inspected  
**Then** open tab shell types are unchanged; only new tabs pick up the updated default

**Given** the tab switcher dropdown or new-tab button  
**When** extended in a future story to offer shell selection  
**Then** this story's per-tab shellType field already supports it with no schema change

---

## Epic 3: Split Pane

**Goal:** Implement vertical split-pane support within a tab — two independent terminal sessions side by side with a draggable divider. Maximum 2 panes per tab.

**Depends on:** Epic 2 (TabManager, tab sessions must exist before splitting)

### Story 3.1: Split Pane Creation

As a user,
I want to split the active terminal pane into two independent sessions with Ctrl+Shift+D,
So that I can monitor two terminal contexts simultaneously within the same tab.

**Acceptance Criteria:**

**Given** a tab with a single active pane  
**When** user presses Ctrl+Shift+D  
**Then** a `tab:create-split` IPC call creates a second `TabSession`; the renderer splits the terminal area into two equal-width panes separated by a 2px divider

**Given** a tab already in split mode  
**When** user presses Ctrl+Shift+D again  
**Then** nothing happens (max 2 panes enforced); no error is shown

**Given** a split is created  
**When** the new pane spawns  
**Then** it uses the default shell, opens in the same cwd as the primary pane, and receives input focus

**Given** a split tab  
**When** the tab is hidden and then shown again  
**Then** both pane sessions are still alive with scrollback intact (hide ≠ close applies to each pane)

**Given** main process `TabManager`  
**When** a split is created  
**Then** both sessions appear as independent `TabSession` entries in the Map; the main process has no "split" concept — only the renderer tracks the split pair

---

### Story 3.2: Split Divider Drag

As a user,
I want to drag the split divider to resize the two panes proportionally,
So that I can allocate more space to the context I need.

**Acceptance Criteria:**

**Given** two split panes  
**When** user hovers over the 2px divider  
**Then** the divider highlights with `--accent` color and cursor changes to `col-resize`; an invisible 8px hit area surrounds the visible divider

**Given** user mousedown on the divider and drags left or right  
**When** dragging is in progress  
**Then** both panes resize proportionally in real-time at 60fps; no IPC calls are made during drag (renderer-only state)

**Given** user mouseup after dragging  
**When** the drag ends  
**Then** each xterm.js instance receives a `terminal:resize` call with the new column/row dimensions; split ratio is NOT persisted to config (resets to 50/50 on next open)

**Given** drag would make either pane narrower than 20% of total width  
**When** dragging  
**Then** the divider snaps to the 20% limit; the minimum pane width is enforced

**Given** drag would make either pane wider than 80%  
**When** dragging  
**Then** the divider snaps to the 80% limit

---

### Story 3.3: Close Pane

As a user,
I want to close one pane in a split, expanding the other to full width,
So that I can return to single-pane focus without losing the remaining session.

**Acceptance Criteria:**

**Given** a tab in split mode with two panes  
**When** user presses Ctrl+W with focus in the right pane  
**Then** the right pane session is closed, the divider disappears, and the left pane expands to full width with no visible flash

**Given** user presses Ctrl+W with focus in the left pane  
**When** processed  
**Then** the left pane session is closed and the right pane expands to full width

**Given** a pane is closed via Ctrl+W  
**When** `tab:close` IPC fires  
**Then** the PTY process for that session is killed; the remaining session is unaffected

**Given** only one pane remains after closing  
**When** the terminal re-renders  
**Then** the single pane receives the full terminal area minus tab bar; xterm.js reflows content correctly

**Given** a split tab where user presses Ctrl+W in the only remaining pane  
**When** processed  
**Then** standard tab close logic applies (hide if last tab, close if not last)

---

## Epic 4: Theming Engine

**Goal:** Implement the dual-channel theming architecture — `ThemeEngine` main-process module, bundled themes (Tokyo Night, Retro Green, Solarized Dark), community theme file watching, and font configuration.

**Depends on:** Epic 1 (config schema must have `theme` key)

### Story 4.1: ThemeEngine Module with Bundled Themes

As a user,
I want QuakeShell to ship with three built-in named themes I can choose from,
So that I have a variety of visual styles without needing external files.

**Acceptance Criteria:**

**Given** the `themes/` directory at the repository root  
**When** it is inspected  
**Then** it contains `tokyo-night.json`, `retro-green.json`, and `solarized-dark.json`, each matching the `ThemeDefinition` interface shape

**Given** the app starts with `config.theme` set to `'tokyo-night'`  
**When** `ThemeEngine.init()` loads  
**Then** Tokyo Night theme tokens are ready to be applied; no error is thrown if theme files are bundled correctly

**Given** a `theme:list` IPC call  
**When** handled  
**Then** the renderer receives an array of available `ThemeDefinition` objects (at minimum the 3 bundled themes)

**Given** `config.theme` changes via hot-reload  
**When** `ThemeEngine` detects the config change  
**Then** `theme:changed` IPC event fires with the new `ThemeDefinition` as payload

**Given** `config.theme` is set to an unknown theme ID that does not exist  
**When** the app loads  
**Then** `ThemeEngine` logs a warning via electron-log and falls back to `'tokyo-night'`

---

### Story 4.2: Dual-Channel Theme Apply (ThemeStyleInjector)

As a user,
I want theme changes to apply instantly to both the terminal colors and the UI chrome simultaneously,
So that there is no flash of mis-themed content when I switch themes.

**Acceptance Criteria:**

**Given** a `theme:changed` event with a new `ThemeDefinition`  
**When** the renderer receives it  
**Then** `ThemeStyleInjector` updates CSS custom properties on `:root` and calls `terminal.options.theme = xtermTheme` on every active xterm.js instance within a single microtask flush

**Given** the CSS custom properties update  
**When** inspected in DevTools  
**Then** `--bg-terminal`, `--bg-chrome`, `--fg-primary`, `--fg-dimmed`, `--accent`, `--border` all reflect the new theme's `chromeTokens` values

**Given** a terminal instance that is in a hidden background tab  
**When** the theme changes  
**Then** the theme is applied to that instance's `terminal.options.theme` so it renders correctly when the tab is next focused

**Given** a new tab is created after a theme change  
**When** its xterm.js instance is initialized  
**Then** it receives the current active theme's `xtermTheme` from the start (not the default Tokyo Night)

---

### Story 4.3: Community Themes (File-Based Loading)

As a power user,
I want to drop a JSON theme file into my QuakeShell config directory and have it automatically available,
So that I can use or share custom themes without modifying the app.

**Acceptance Criteria:**

**Given** a valid `ThemeDefinition` JSON file placed in `%APPDATA%/QuakeShell/themes/`  
**When** the app is running  
**Then** `ThemeEngine` detects the new file within 2 seconds and adds the theme to the available list

**Given** the theme is added  
**When** `theme:list` IPC is called  
**Then** the community theme appears in the response alongside bundled themes

**Given** an invalid JSON file placed in the themes directory  
**When** `ThemeEngine` attempts to parse it  
**Then** it logs a warning via electron-log and skips the file; no crash

**Given** a community theme file that references an unknown `ThemeDefinition` property  
**When** parsed  
**Then** extra properties are ignored; the theme is loaded if required fields (`id`, `name`, `xtermTheme`, `chromeTokens`) are present and valid

**Given** a community theme file is deleted from the directory  
**When** the file watcher detects the deletion  
**Then** the theme is removed from the available list; if it was active, `ThemeEngine` falls back to `'tokyo-night'`

---

### Story 4.4: Font Configuration

As a user,
I want to configure the terminal font family, size, and line height,
So that I can adjust the terminal to my visual preferences and accessibility needs.

**Acceptance Criteria:**

**Given** `config.fontFamily` is set to `'JetBrains Mono'`  
**When** the terminal renders  
**Then** xterm.js `options.fontFamily` is updated to `'JetBrains Mono'` and the terminal displays with that font (subject to the font being installed on the system)

**Given** `config.fontSize` is set to `16`  
**When** the terminal renders  
**Then** xterm.js `options.fontSize` is `16` and the hot-reload applies without restart

**Given** `config.lineHeight` is set to `1.4`  
**When** applied  
**Then** xterm.js `options.lineHeight` is `1.4` and the terminal reflows content accordingly

**Given** font config changes via hot-reload  
**When** the config watcher fires  
**Then** xterm.js options update and the terminal reflows content in the current frame — no restart required

**Given** `config.fontSize` is set to an out-of-range value (e.g., `5` or `72`)  
**When** validated  
**Then** Zod schema clamps or rejects the value; a sensible default (14) is used with a warning logged

---

## Epic 5: Settings GUI Overlay

**Goal:** Implement the in-app Settings GUI overlay (Ctrl+,) that covers all Phase 2 configurable settings without requiring JSON editing. Settings reuse all existing config IPC channels.

**Depends on:** Epic 1 (config schema), Epic 4 (ThemeEngine for theme selector)

### Story 5.1: Settings Panel Overlay Shell

As a user,
I want to open an in-app settings overlay with Ctrl+, that I can dismiss with Escape,
So that I can access all settings without leaving the terminal or opening a separate window.

**Acceptance Criteria:**

**Given** the terminal is visible  
**When** user presses Ctrl+,  
**Then** the Settings overlay renders above the active terminal within 100ms; the running terminal session remains alive behind it

**Given** the settings button (⚙) in the tab bar  
**When** clicked  
**Then** the Settings overlay opens (same result as Ctrl+,)

**Given** the Settings overlay is open  
**When** user presses Escape  
**Then** the overlay closes and focus returns to the active terminal xterm instance

**Given** the Settings overlay  
**When** rendered  
**Then** it contains tab navigation: General | Appearance | Themes | Keyboard | Distribution; max width 600px, centered in terminal area; backdrop dim behind it

**Given** a settings change made in the overlay  
**When** saved  
**Then** it calls the existing `quakeshell.config.set` IPC channel — no new IPC needed; changes hot-reload immediately

**Given** the "Edit Config File" button in any Settings tab  
**When** clicked  
**Then** the config JSON file opens in the user's default editor (same as tray "Edit Settings" behaviour)

---

### Story 5.2: Settings — General Tab

As a user,
I want a General settings tab with controls for shell, hotkey, focus-fade, autostart, window dimensions, and monitor selection,
So that I can configure all core behaviours from the GUI.

**Acceptance Criteria:**

**Given** the General settings tab  
**When** rendered  
**Then** it shows: default shell dropdown (PowerShell / WSL / cmd / Git Bash / Custom path), hotkey display with remap instructions, focus-fade toggle, autostart toggle, terminal height slider (10%–90%), terminal width slider (20%–100%), monitor dropdown (Active Monitor / Primary Monitor / Monitor 1…N)

**Given** user changes the default shell dropdown  
**When** the change is committed  
**Then** `config.defaultShell` is updated via `quakeshell.config.set`; existing open tabs keep their shell; new tabs use the new default

**Given** user adjusts the terminal height slider  
**When** the slider is released  
**Then** `config.window.heightPercent` is updated and the window resizes immediately

**Given** user adjusts the terminal width slider  
**When** the slider is released  
**Then** `config.window.widthPercent` is updated and the window width adjusts immediately

**Given** user selects a monitor in the monitor dropdown  
**When** the terminal next shows  
**Then** it appears on the selected monitor

**Given** running on Windows 11 22H2+  
**When** the General tab is rendered  
**Then** an "Acrylic blur" toggle is visible; on all other OS versions, this toggle is hidden

**Given** user enables the acrylic blur toggle  
**When** the setting is saved  
**Then** `config.acrylicBlur` becomes `true` and `window-manager.ts` applies `backgroundMaterial: 'acrylic'`; if the API call fails, electron-log captures the error and the toggle reverts to off

---

### Story 5.3: Settings — Appearance Tab

As a user,
I want an Appearance settings tab with font configuration controls,
So that I can adjust visual properties without editing JSON.

**Acceptance Criteria:**

**Given** the Appearance settings tab  
**When** rendered  
**Then** it shows: font family text input, font size number input (8–48), line height number input (1.0–2.0), opacity slider (10%–100%), and a live terminal preview reflecting changes in real-time

**Given** user types a font family name and presses Enter or tabs out  
**When** processed  
**Then** `config.fontFamily` is updated and the terminal reflects the new font immediately (if installed); if the font is not found, xterm.js falls back to its monospace fallback silently

**Given** user changes font size  
**When** the input loses focus  
**Then** `config.fontSize` is updated and the terminal reflows

**Given** user drags the opacity slider  
**When** dragging  
**Then** the terminal opacity updates in real-time (same behaviour as v1 opacity hot-reload)

---

### Story 5.4: Settings — Themes Tab

As a user,
I want a Themes settings tab that shows all available themes with a live preview,
So that I can visually explore and select a theme.

**Acceptance Criteria:**

**Given** the Themes settings tab  
**When** rendered  
**Then** all available themes (bundled + community) are displayed as cards showing: theme name, colour swatch strip (6–8 representative ANSI colors), and a mini terminal preview

**Given** user clicks a theme card  
**When** processed  
**Then** the live terminal behind the overlay immediately reflects the new theme (xterm.js ITheme + CSS custom properties update; ThemeStyleInjector fires)

**Given** user closes the Settings overlay after selecting a theme  
**When** overlay closes  
**Then** the selected theme is persisted to `config.theme`

**Given** user opens Settings and the currently active theme is displayed  
**When** rendered  
**Then** the active theme card is highlighted with a `--accent` border indicator

**Given** a community theme file exists in the user directory  
**When** the Themes tab is opened  
**Then** the community theme appears in the list alongside bundled themes (no app restart required)

---

### Story 5.5: Settings — Keyboard Tab

As a user,
I want a Keyboard settings tab that displays all QuakeShell shortcuts and lets me remap the toggle hotkey,
So that I can resolve conflicts and learn available shortcuts from within the app.

**Acceptance Criteria:**

**Given** the Keyboard settings tab  
**When** rendered  
**Then** the toggle hotkey is shown with a "Remap" button; a reference table lists all Phase 2 shortcuts (Ctrl+T, Ctrl+W, Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+1–9, Ctrl+Shift+D, Ctrl+,)

**Given** user clicks "Remap" next to the toggle hotkey  
**When** activated  
**Then** a "Press new shortcut" recording mode captures the next key combination pressed

**Given** user presses a new key combination in recording mode  
**When** recorded  
**Then** `config.hotkey` is updated via `quakeshell.config.set`; the hotkey is re-registered; recording mode exits

**Given** the new hotkey conflicts with a known system shortcut  
**When** conflict detection logic fires  
**Then** a warning message is shown inline ("This shortcut may conflict with another app") but the user can still save it

---

### Story 5.6: Settings — Distribution Tab

As a user,
I want a Distribution settings tab with a context menu registration toggle,
So that I can enable or disable "Open QuakeShell here" in Explorer without reinstalling.

**Acceptance Criteria:**

**Given** the Distribution settings tab  
**When** rendered  
**Then** it shows the context menu registration status ("Registered" or "Not registered") and a Register / Deregister button

**Given** the context menu entry is not registered  
**When** user clicks "Register"  
**Then** `app:register-context-menu` IPC is called, the registry entries are written, and the status updates to "Registered"

**Given** the context menu entry is registered  
**When** user clicks "Deregister"  
**Then** `app:deregister-context-menu` IPC is called, the registry entries are removed, and the status updates to "Not registered"

**Given** the registration or deregistration fails (e.g., registry write error)  
**When** the error is caught  
**Then** electron-log captures it; the UI shows an inline error message; the status does not falsely update

---

## Epic 6: Shell Context Menu

**Goal:** Register "Open QuakeShell here" in Windows Explorer's right-click context menu using HKCU registry writes via `child_process`. Integrate with Squirrel installer lifecycle hooks. Support the `--cwd` CLI argument.

**Depends on:** Epic 2 (TabManager.createTab must support `{ cwd }` option)

### Story 6.1: Context Menu Installer Module

As a developer,
I want a `context-menu-installer.ts` module that registers and deregisters the Explorer context menu entry,
So that the registry operations are encapsulated and callable from installer hooks and the Settings GUI.

**Acceptance Criteria:**

**Given** `context-menu-installer.ts` is created  
**When** `register()` is called  
**Then** two registry keys are written via `child_process.execSync('reg add ...')`:
- `HKCU\Software\Classes\Directory\shell\QuakeShell` (folder right-click)
- `HKCU\Software\Classes\Directory\Background\shell\QuakeShell` (folder background right-click)

**Given** the registry keys are written  
**When** user right-clicks a folder in Windows Explorer  
**Then** "Open QuakeShell here" appears in the context menu

**Given** `deregister()` is called  
**When** executed  
**Then** both registry keys are deleted using `reg delete /f`; "Open QuakeShell here" no longer appears in Explorer

**Given** the registry write or delete operation fails  
**When** the error is caught  
**Then** it is logged via electron-log with full error details; the function throws so the caller can handle it (Settings UI shows error)

**Given** `isRegistered()` is called  
**When** executed  
**Then** it returns `true` if the registry key exists, `false` otherwise (used by Settings to show current status)

**Given** all registry operations  
**When** inspected  
**Then** they target HKCU (current user) — no UAC prompt is required

---

### Story 6.2: Squirrel Lifecycle Hook Integration

As a developer,
I want the context menu entry to be automatically registered on install and deregistered on uninstall,
So that users who install via Squirrel get the feature without opening Settings.

**Acceptance Criteria:**

**Given** Squirrel passes `--squirrel-install` at install time  
**When** `app-lifecycle.ts` handles the flag  
**Then** `ContextMenuInstaller.register()` is called; errors are logged but do not block install completion

**Given** Squirrel passes `--squirrel-updated` at update time  
**When** handled  
**Then** `ContextMenuInstaller.register()` is called to ensure the registry entries are current after the update

**Given** Squirrel passes `--squirrel-uninstall` at uninstall time  
**When** handled  
**Then** `ContextMenuInstaller.deregister()` is called; errors are logged but do not block uninstall completion

**Given** the existing v1 Squirrel handler in `app-lifecycle.ts`  
**When** updated  
**Then** the single-instance lock, tray cleanup, and all existing v1 Squirrel behaviour remain unchanged

---

### Story 6.3: --cwd CLI Argument

As a user,
I want the Explorer context menu to open a new QuakeShell tab in the right-clicked folder,
So that I can start a terminal session in any directory without navigating there manually.

**Acceptance Criteria:**

**Given** the context menu command is configured with `quakeshell.exe --cwd "%V"`  
**When** user right-clicks a folder and selects "Open QuakeShell here"  
**Then** QuakeShell launches (or focuses if already running) and opens a new tab with `cwd` set to the right-clicked path

**Given** QuakeShell is already running (single-instance)  
**When** a second instance is launched with `--cwd <path>`  
**Then** the second instance forwards the `--cwd` argument to the first instance via the single-instance lock mechanism; the first instance opens a new tab in that directory and brings the window into view

**Given** `app-lifecycle.ts` parses `process.argv`  
**When** `--cwd` is found  
**Then** `TabManager.createTab({ cwd: parsedPath })` is called with the provided path

**Given** the `--cwd` path does not exist on disk  
**When** the tab is created  
**Then** the PTY spawns in the user's home directory as a fallback; no crash

**Given** the `--cwd` path contains spaces or special characters  
**When** parsed  
**Then** the path is handled correctly (the registry command uses `"%V"` quoting)

---

## Epic 7: Distribution Packaging

**Goal:** Set up Scoop and Winget distribution manifests via CI automation. Zero `src/` changes — CI/manifest work only.

**Depends on:** Nothing (fully independent of all src/ changes)

### Story 7.1: Scoop Package Manifest

As a Windows power user,
I want to install QuakeShell via `scoop install QuakeShell`,
So that I can install and update it using my preferred package manager without visiting a download page.

**Acceptance Criteria:**

**Given** a new GitHub release is published  
**When** the release GitHub Action runs  
**Then** `scripts/generate-scoop-manifest.js` reads `package.json` version and the Squirrel installer artifact URL, generates `QuakeShell.json` matching the Scoop manifest schema, and pushes it to the `quakeshell-bucket` GitHub repository

**Given** the generated `QuakeShell.json`  
**When** validated against Scoop manifest schema  
**Then** it contains: `version`, `url` (HTTPS to Squirrel `.exe`), `hash` (SHA256), `installer.script` Scoop install hook, `uninstaller.script`, `bin` path

**Given** a user runs `scoop bucket add quakeshell https://github.com/[owner]/quakeshell-bucket`  
**When** followed by `scoop install QuakeShell`  
**Then** the Squirrel installer downloads and runs; QuakeShell installs to the Scoop apps directory

**Given** `forge.config.ts`  
**When** inspected  
**Then** it is unchanged from v1 — Scoop support requires no changes to the Electron Forge config

---

### Story 7.2: Winget Package Manifest

As a Windows user,
I want to install QuakeShell via `winget install QuakeShell`,
So that I can use Windows' built-in package manager to install and update it.

**Acceptance Criteria:**

**Given** a new GitHub release is published  
**When** the release GitHub Action runs  
**Then** YAML manifests (installer, locale, version) are generated and a PR is automatically opened against `microsoft/winget-pkgs` via the `vedantmgoyal9/winget-releaser` GitHub Action

**Given** the generated Winget YAML manifests  
**When** validated against Winget manifest schema (v1.6.0)  
**Then** they contain: `PackageIdentifier`, `PackageVersion`, `InstallerType: wix` or `inno`, `InstallerUrl` (HTTPS), `InstallerSha256`, `PackageName`, `Publisher`, `License`, `ShortDescription`

**Given** the Winget PR is merged  
**When** a user runs `winget install QuakeShell`  
**Then** the Squirrel installer is downloaded and executed; QuakeShell installs correctly

**Given** `forge.config.ts` and all `src/` files  
**When** inspected  
**Then** they are unchanged by this story — Winget support is CI and manifest only
