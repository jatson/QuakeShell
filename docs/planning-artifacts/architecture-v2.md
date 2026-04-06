---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-04-01'
inputDocuments:
  - docs/planning-artifacts/prd.md
  - docs/planning-artifacts/architecture.md
  - docs/planning-artifacts/ux-design-specification.md
  - docs/planning-artifacts/product-brief-QuakeShell.md
  - docs/planning-artifacts/epics.md
  - docs/planning-artifacts/research/technical-quake-terminal-windows-research-2026-03-31.md
workflowType: 'architecture'
project_name: 'QuakeShell'
user_name: 'Barna'
date: '2026-04-01'
---

# Architecture Decision Document — Phase 2

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

_Phase 2 extends the v1 architecture (docs/planning-artifacts/architecture.md) with decisions for multi-tab, split-pane, theming, multi-shell, dimensions config, distribution packaging, and shell context menu integration._

---

## Project Context Analysis

### Requirements Overview

**Phase 2 Functional Scope (from PRD §Post-MVP):**

| Feature Area | Requirements |
|---|---|
| Multi-tab sessions | Create/close/switch/rename tabs; browser-style shortcuts (Ctrl+T/W/Tab/1-9); tab auto-naming (git repo → process → shell → directory); color palette per tab |
| Split-pane | Vertical split only; max 2 panes per tab; draggable divider; independent PTY sessions; close one pane expands other |
| Theming engine | Named theme presets bundled with the app; community themes importable via config; xterm.js ITheme + CSS custom property tokens applied together |
| Multi-shell per tab | Each tab carries its own `shellType` (PowerShell, WSL, cmd, Git Bash, custom path); new tab defaults to `config.defaultShell` |
| Custom colors & fonts | Per-theme color tokens + xterm.js ITheme coverage; font family, size, line height configurable via Settings GUI |
| Dimensions & monitor config | `window.width` (% of monitor width; default 100%); `window.monitor` enum ('active' \| 'primary' \| index); Settings GUI for both |
| Scoop & Winget distribution | Scoop manifest in GitHub repo; Winget manifest submitted to winget-pkgs; no runtime code change — forge.config.ts + CI only |
| Shell context menu | "Open QuakeShell here" right-click on folders; Squirrel lifecycle hooks + HKCU registry write; `--cwd <path>` CLI arg opens new tab in that directory |
| Settings GUI overlay | In-app settings panel (Ctrl+,) as Preact overlay within the renderer; reads/writes same JSON config via existing IPC; replaces JSON-only editing for common settings |

**v1 invariants that must be preserved (non-negotiable):**
- Hide ≠ Close — sessions, scrollback, and processes survive all hide operations
- <100ms toggle latency — tab bar adds 32px layout but must not cause repaint delay
- Hot-reload config — all new config keys apply without restart
- IPC security boundary — all new channels go through contextBridge, follow `domain:action` naming
- <80MB idle RAM — multi-tab creates multiple PTY processes; each adds ~5–10MB; architecture must account for session lifecycle

**Scale & Complexity:**
- Complexity level: Low-medium (still the same stack; PTY multiplexing is the biggest new concern)
- Primary domain: Desktop (Electron, Windows-only)
- New architectural components: 3 main process modules (`TabManager`, `ThemeEngine`, `ContextMenuInstaller`) + 4 renderer component trees (TabBar, SplitPane, Settings GUI, ThemeSelector)
- No backend, no cloud API, no auth — all complexity is local process management and renderer UI composition

### Technical Constraints & Dependencies

- **Same runtime:** Electron 41+, Node 24, Chromium 146 — no version migration needed
- **Acrylic Blur (Win11 22H2+):** Electron's `BrowserWindow.setWindowButtonVisibility()` + `backgroundMaterial` API (Electron 36+); `os.release()` detect for graceful fallback to opacity on older Windows
- **Scoop manifest:** JSON5 file committed to GitHub (auto-generated from package.json version); no new npm dependency
- **Winget manifest:** YAML submitted to microsoft/winget-pkgs; GitHub Action automation via `vedantmgoyal2009/winget-releaser@v2` or similar; no runtime code
- **Shell context menu (HKCU):** Uses `regedit` npm package or Node child_process to write Windows Registry under `HKCU\Software\Classes\Directory\shell\QuakeShell`; **user-scope only** (no admin required)
- **Tab auto-naming:** Reads PTY working directory via `process-env` or `node-pty` `onData` output parsing; Git repo detection via `simple-git` or `child_process git rev-parse --show-toplevel`

### Cross-Cutting Concerns

1. **Session lifecycle with tabs** — `TabManager` becomes the authoritative session list; `TerminalManager` handles PTY I/O per session; `ipc-handlers.ts` routes terminal data events with `tabId` in payload
2. **Theme application split** — themes apply across two independent systems: xterm.js ITheme (terminal colors) and CSS custom properties (chrome: tab bar, handles, overlays). Both must update atomically when theme changes
3. **Config schema additive migration** — new Phase 2 config keys (tabs, theme, window.width, window.monitor) use Zod `.default()` — existing v1 configs load without error, new keys get defaults automatically
4. **Focus management with tabs** — toggling QuakeShell must focus the active tab's xterm instance, not the tab bar or split container; `tabId` must be tracked in `WindowStore`
5. **Memory budget with multi-session** — up to 10 tabs × ~8MB per PTY process = ~80MB PTY overhead on top of Electron baseline; `TabManager` must support explicit session close (not just hide)

---

## Starter Template Evaluation

**Not applicable — existing project.**

QuakeShell is already bootstrapped with `electron-forge vite-typescript`. All v1 decisions carry forward unchanged:

| Already Decided | Carried Forward |
|---|---|
| Electron Forge + Vite + TypeScript | ✅ No change |
| Preact + `@preact/signals` | ✅ No change — Phase 2 adds more components, same patterns |
| Zod config schema | ✅ Extended additively — no breaking changes |
| electron-store | ✅ No change |
| electron-log scoped loggers | ✅ No change — new modules add scoped loggers |
| Vitest + Playwright | ✅ No change — new modules add tests |
| CSS Modules + CSS custom properties | ✅ No change — theme engine swaps custom property values |
| IPC `invoke`/`handle` + `send`/`on` pattern | ✅ Extended with new channels |
| Security hardening (contextIsolation, sandbox, fuses) | ✅ No change |

The only new dependencies to evaluate are covered in Decision 9 (registry writes) and Decision 10 (git repo detection for tab auto-naming).

---

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (block Phase 2 implementation):**

| # | Decision | Choice |
|---|---|---|
| P2-1 | Tab Session Model | `TabManager` with `Map<tabId, TabSession>` in main process |
| P2-2 | Theme Architecture | Two-channel apply: xterm.js ITheme + CSS custom property swap |
| P2-3 | Config Schema Migration Strategy | Additive-only Zod `.default()` — no destructive field changes |
| P2-4 | Split Pane State Ownership | Renderer-owned pane layout; only `tabId` communicated over IPC |

**Important Decisions:**

| # | Decision | Choice |
|---|---|---|
| P2-5 | Settings GUI Architecture | Preact overlay in renderer; existing IPC config channels unchanged |
| P2-6 | Acrylic Blur Feature Detection | Runtime OS version check; `backgroundMaterial` Electron API with opacity fallback |
| P2-7 | Shell Context Menu Registration | HKCU registry via Node child_process; Squirrel lifecycle hooks |
| P2-8 | Tab Auto-Naming Strategy | `simple-git` for repo detection; process name from PTY cwd heuristic |
| P2-9 | Distribution (Scoop + Winget) | Generated manifests in CI; no runtime code impact |

---

### Decision P2-1: Tab Session Model

- **Choice:** `TabManager` module owns a `Map<tabId, TabSession>` in the main process. `TerminalManager` becomes a lower-level PTY I/O utility called by `TabManager`.
- **TabSession shape:**
  ```typescript
  interface TabSession {
    id: string;           // crypto.randomUUID()
    shellType: Shell;     // per-tab shell override
    ptyProcess: IPty;
    color: TabColor;      // auto-assigned from palette
    manualName?: string;  // set by user rename; overrides auto-name
    splitPaneId?: string; // second PTY when split; undefined = no split
  }
  ```
- **Rationale:** Keying by UUID avoids index fragmentation when tabs are closed/reordered. `TerminalManager` retains all PTY lifecycle logic (spawn, write, resize, crash recovery) — `TabManager` composes it. This isolates multi-tab logic without rewriting v1's stable PTY plumbing.
- **Active tab tracking:** `activeTabId: string` signal in renderer `TabStore`; mirrored to main via `tab:switch` IPC channel for focus management.
- **Session close vs. hide:** `tab:close` IPC channel explicitly kills the PTY and removes from Map. Hide never kills. This is the first non-hide path to session end in QuakeShell's architecture.
- **Affects:** `terminal-manager.ts` (refactored into utility), new `tab-manager.ts`, `ipc-handlers.ts`, renderer `TabStore`, all terminal data events gain `tabId` in payload

---

### Decision P2-2: Theme Architecture

- **Choice:** Dual-channel theme application. A `ThemeEngine` module manages:
  1. **xterm.js channel:** Applies `ITheme` object to each active `Terminal` instance via `terminal.options.theme`
  2. **CSS channel:** Updates CSS custom properties on `:root` by writing a `<style>` tag in the renderer or via IPC event that updates a signal read by a `ThemeStyleInjector` component
- **Theme Definition format:**
  ```typescript
  interface ThemeDefinition {
    id: string;            // kebab-case: 'tokyo-night', 'retro-green'
    name: string;          // display name: 'Tokyo Night'
    xtermTheme: ITheme;    // all 16 ANSI colors + bg/fg/cursor/selection
    chromeTokens: {        // CSS custom property overrides for UI chrome
      bgTerminal: string;
      bgChrome: string;
      fgPrimary: string;
      fgDimmed: string;
      accent: string;
      border: string;
    };
  }
  ```
- **Bundled themes:** `themes/` directory at repo root. Tokyo Night (default), Retro Green (CRT), Solarized Dark. Loaded at startup by `ThemeEngine`.
- **Community themes:** User drops a JSON file matching `ThemeDefinition` shape into `%APPDATA%/QuakeShell/themes/`. `ThemeEngine` watches this directory and adds discovered themes to the available list.
- **Active theme:** Stored as `config.theme` (theme `id` string). Hot-reloaded when config changes.
- **Rationale:** Separating xterm.js theme from CSS tokens allows theme authors to control both terminal color rendering and UI chrome in one file. The dual-apply is synchronous — both channels fire before the next frame, avoiding a flash of mis-themed chrome.
- **Affects:** New `theme-engine.ts`, `config-schema.ts` (new `theme` field), `ipc-handlers.ts` (new `theme:list`, `theme:set` channels), renderer `ThemeStore`, `global.css` (custom properties become dynamic), new `themes/` directory

---

### Decision P2-3: Config Schema Migration Strategy

- **Choice:** Additive-only changes using Zod `.default()`. New Phase 2 keys have defaults; loading a v1 config silently migrates forward.
- **New Phase 2 config keys:**
  ```typescript
  // New keys added to existing Config schema
  theme: z.string().default('tokyo-night'),
  window: z.object({
    heightPercent: z.number().min(10).max(90).default(30),   // exists in v1
    widthPercent: z.number().min(20).max(100).default(100),  // new in v2
    monitor: z.union([z.literal('active'), z.literal('primary'), z.number()]).default('active'), // new in v2
  }),
  tabs: z.object({
    colorPalette: z.array(z.string()).default(['#7aa2f7','#9ece6a','#bb9af7','#e0af68','#7dcfff','#f7768e']),
    maxTabs: z.number().min(1).max(20).default(10),
  }),
  ```
- **No destructive changes:** v1 keys (`hotkey`, `defaultShell`, `opacity`, `focusFade`, `animationSpeed`, `fontSize`, `fontFamily`) are untouched.
- **Schema location:** `src/shared/config-schema.ts` — both processes share the same schema, as in v1.
- **Rationale:** `.default()` on every new field means zero migration code and zero user-facing prompts. Zod `safeParse` with defaults is the v1 pattern already in production — Phase 2 simply extends it.
- **Affects:** `src/shared/config-schema.ts` (additive only), `src/shared/config-types.ts`, `src/main/config-store.ts` (no logic changes — schema does the work)

---

### Decision P2-4: Split Pane State Ownership

- **Choice:** Pane layout (single vs. split, divider ratio) is **renderer-owned state** only. The main process has no concept of "split" — it manages two independent `TabSession` entries. The renderer's `SplitPane` component decides which two `tabId`s to render side-by-side.
- **Split model:**
  - A split is a pair of tab sessions: `primaryTabId` + `splitTabId`. Both entries exist as normal `TabSession` objects in `TabManager`.
  - The renderer `TabStore` tracks a `splitPairs: Map<tabId, tabId>` signal. When a split is requested, `tab:create-split` IPC creates a second session and returns its `tabId`; renderer stores the pair.
  - Tab bar shows both sessions as a single visual tab with a split indicator.
  - `SplitPane` component renders two `TerminalView` instances side-by-side with a `SplitDivider` between them.
  - Divider ratio (`splitRatio: number`) lives in renderer signal only — not persisted (restores to 50/50 on next open).
- **Rationale:** Keeping split layout in the renderer avoids IPC round-trips during drag (resizing the divider would require 60fps IPC calls if the ratio were main-process-owned). The renderer handles all divider drag events locally and only calls `terminal:resize` when dragging stops.
- **Affects:** New `SplitPane/` component tree, `tab-store.ts` (splitPairs signal), `ipc-handlers.ts` (new `tab:create-split` channel), `window-manager.ts` (must resize both xterm instances on BrowserWindow resize)

---

### Decision P2-5: Settings GUI Architecture

- **Choice:** Preact overlay within the renderer — same drop-down window, same `App.tsx` routing. Opens on `Ctrl+,` or Settings button in tab bar. Reads/writes via existing `quakeshell.config.get/set` IPC — **no new IPC channels needed for settings**.
- **Component:** `SettingsPanel.tsx` becomes a full overlay (was a v1 partial panel). Tabs within Settings: General, Appearance, Themes, Keyboard, Distribution.
- **Settings overlay does NOT block the terminal** — rendered above the active terminal, dismissible with Escape.
- **v1 JSON editing is preserved** — "Edit Config File" button in Settings keeps the power-user escape hatch.
- **Rationale:** Re-using existing config IPC means Settings GUI is purely a renderer problem — no new main process code. The architecture scales: adding a new settings field requires only Zod schema + renderer component, not new IPC.
- **Affects:** `src/renderer/components/Settings/SettingsPanel.tsx` (extended), new child components (`ThemeSelector.tsx`, `FontConfig.tsx`, `TabColorPicker.tsx`, `MonitorSelector.tsx`), `src/preload/index.ts` (add `Ctrl+,` listener), `channels.ts` (add `window:open-settings` event)

---

### Decision P2-6: Acrylic Blur Feature Detection

- **Choice:** Runtime OS version detection using `os.release()`. If Windows 11 (build ≥ 22621, which is 22H2), set `BrowserWindow`'s `backgroundMaterial: 'acrylic'` (Electron 36+ API). Otherwise, maintain the existing opacity approach.
- **User control:** `config.acrylicBlur: boolean` (default `false` — opt-in). Only shown in Settings on Win11 22H2+ systems; hidden on unsupported OS.
- **Fallback guarantee:** If `backgroundMaterial` API call throws (unexpected OS behavior), catch, log via electron-log, and fall back to opacity. The user never sees an unresponsive terminal.
- **Rationale:** Acrylic blur is visually compelling on Win11 but not worth a hard dependency. Opt-in + graceful fallback preserves the v1 experience on all supported Windows versions (Windows 10 1809+).
- **Affects:** `src/main/window-manager.ts` (BrowserWindow creation + hot-reload on config change), `src/shared/config-schema.ts` (new `acrylicBlur` field), `src/renderer/components/Settings/` (conditional UI)

---

### Decision P2-7: Shell Context Menu Registration

- **Choice:** Windows Registry write to `HKCU\Software\Classes\Directory\shell\QuakeShell` and `HKCU\Software\Classes\Directory\Background\shell\QuakeShell` using Node's `child_process.execSync('reg add ...')`. No third-party registry library — avoid native module complexity.
- **Lifecycle hooks:** Squirrel.Windows emits `--squirrel-install`, `--squirrel-updated`, `--squirrel-uninstall` flags at install/uninstall time. `app-lifecycle.ts` already handles these in v1 (single instance). Phase 2 adds:
  - `squirrel-install` / `squirrel-updated` → register context menu entry
  - `squirrel-uninstall` → unregister context menu entry
- **CLI flag:** Context menu passes `quakeshell.exe --cwd "C:\path"`. `AppLifecycle` parses `process.argv` for `--cwd` and passes it to `TabManager.createTab({ cwd })`.
- **User toggle:** Settings has "Register 'Open QuakeShell here' in Explorer context menu" toggle → calls `context-menu-installer.ts` directly (re-register or deregister on demand without reinstalling).
- **Rationale:** HKCU (not HKLM) requires no admin elevation — install silently. Pure `child_process` avoids a native module rebuild.
- **Affects:** New `src/main/context-menu-installer.ts`, `src/main/app-lifecycle.ts` (Squirrel hooks), `src/shared/channels.ts` (new `app:register-context-menu` channel), Settings UI

---

### Decision P2-8: Tab Auto-Naming Strategy

- **Choice:** Two-step resolution on tab creation and on cwd change events:
  1. **Working directory tracking:** node-pty fires `onExit` and data events; cwd is polled via `process.cwd()` equivalent — specifically, Windows `wmic process get ExecutablePath,ProcessId` or `Get-Process -Id {ptyPid} | Select-Object Path` via PowerShell. Polled every 2 seconds when tab is active.
  2. **Git repo detection:** Once cwd is known, `child_process.execSync('git rev-parse --show-toplevel', { cwd })` — if succeeds, use the basename of the returned path as tab name. If fails (not a git repo), fall to next priority.
  3. **Process name:** Parse PTY stdout heuristic for headless processes (`npm run dev`, `docker compose up`). Pattern: if last command with no prompt returned = running process. Use its name. *(Best-effort, not guaranteed.)*
  4. **Shell type fallback:** `Shell.PowerShell` → "pwsh", `Shell.WSL` → "WSL", `Shell.Cmd` → "cmd", `Shell.GitBash` → "bash"
  5. **Working directory basename:** `path.basename(cwd)` as last resort.
- **Manual override:** User double-click rename sets `TabSession.manualName`; auto-naming resumes only when tab is closed and reopened.
- **Rationale:** `simple-git` (npm package) was evaluated but adds a dependency for a one-line `execSync`. Bare `child_process` keeps the bundle lean and avoids a native module audit.
- **Affects:** `tab-manager.ts` (cwd polling + auto-name resolution), `src/shared/ipc-types.ts` (TabSession type), `channels.ts` (new `tab:auto-name` event)

---

### Decision P2-9: Distribution (Scoop & Winget)

- **Choice:** CI-generated manifests, no runtime code impact.
  - **Scoop:** A `QuakeShell.json` manifest committed to a separate public `quakeshell-bucket` GitHub repo. GitHub Action on npm publish reads `package.json` version + release asset URL, generates and pushes the updated manifest. No change to `forge.config.ts`.
  - **Winget:** A YAML manifest submitted to `microsoft/winget-pkgs` via PR on each release. GitHub Action uses `vedantmgoyal9/winget-releaser` action to automate PR creation.
  - **Electron Forge Squirrel maker:** Already produces the `.exe` installer needed for both manifests (`@electron-forge/maker-squirrel`). No new makers needed.
- **Rationale:** Both package managers consume the existing Squirrel installer artifact. Distribution is purely a CI/manifest problem — the application binary is unchanged.
- **Affects:** `.github/workflows/release.yml` (extended), new `scripts/generate-scoop-manifest.js` utility, no `src/` changes

---

### Decision Impact Analysis

**Implementation Sequence:**
1. Config schema extension (P2-3) — foundation for all new config fields
2. Tab Session Model (P2-1) — `TabManager` + extended IPC channels + `TabStore`
3. Split Pane (P2-4) — depends on tab infrastructure
4. Theme Engine (P2-2) — depends on config schema; independent of tabs
5. Settings GUI (P2-5) — depends on theme engine; uses all existing IPC
6. Acrylic Blur (P2-6) — window-manager extension; independent
7. Shell Context Menu (P2-7) — app-lifecycle extension; independent
8. Tab Auto-Naming (P2-8) — tab-manager extension; can ship after basic tabs work
9. Distribution (P2-9) — CI only; independent of all src/ changes

**Cross-Component Dependencies:**

| Decision | Depends On | Depended By |
|---|---|---|
| Tab Session Model (P2-1) | Config schema (P2-3) | Split Pane, Tab Auto-Naming, Settings GUI |
| Theme Engine (P2-2) | Config schema (P2-3) | Settings GUI (ThemeSelector), renderer ThemeStore |
| Config Schema (P2-3) | None | All other decisions |
| Split Pane (P2-4) | Tab Session Model | Settings GUI (split ratio config) |
| Settings GUI (P2-5) | All above | None |
| Acrylic Blur (P2-6) | Config schema, WindowManager | Settings GUI |
| Context Menu (P2-7) | AppLifecycle, TabManager | Settings GUI toggle |
| Tab Auto-Naming (P2-8) | TabManager | TabStore (name signal) |
| Distribution (P2-9) | None (CI only) | None |

---

## Implementation Patterns & Consistency Rules

_All v1 patterns from [architecture.md](architecture.md) remain in force. The following extend them for Phase 2._

### New Naming Patterns

**Tab IDs:**
- Format: `crypto.randomUUID()` — 36-character UUID v4 string
- Never exposed to user; used only in IPC payloads and internal Maps
- Example: `"3f2504e0-4f89-11d3-9a0c-0305e82c3301"`

**Theme IDs:**
- Format: `kebab-case`, lowercase
- Bundled themes: `tokyo-night` (default), `retro-green`, `solarized-dark`
- Community themes: filename without extension, normalized to kebab-case on load
- Stored as `config.theme` string; validated against discovered theme list at load time (falls back to `tokyo-night` if ID not found)

**New IPC Channel Naming (extends `src/shared/channels.ts`):**

| Channel | Direction | Purpose |
|---|---|---|
| `tab:create` | renderer→main (invoke) | Create new tab, returns `TabSession` |
| `tab:close` | renderer→main (invoke) | Kill PTY + remove from Map |
| `tab:switch` | renderer→main (invoke) | Set active tab (focus PTY) |
| `tab:rename` | renderer→main (invoke) | Set `manualName` |
| `tab:list` | renderer→main (invoke) | Return current `TabSession[]` |
| `tab:create-split` | renderer→main (invoke) | Create second session for split pane |
| `tab:data` | main→renderer (send) | PTY stdout — payload includes `tabId` |
| `tab:exited` | main→renderer (send) | PTY exited — payload: `{ tabId, code }` |
| `tab:auto-name` | main→renderer (send) | Name resolved — payload: `{ tabId, name }` |
| `theme:list` | renderer→main (invoke) | Return available `ThemeDefinition[]` |
| `theme:set` | renderer→main (invoke) | Set active theme, hot-reloads across all terminals |
| `theme:changed` | main→renderer (send) | Push updated `ThemeDefinition` to renderer |
| `window:open-settings` | renderer→main (invoke) | Signal main to focus settings overlay |
| `app:register-context-menu` | renderer→main (invoke) | Register/deregister Explorer context menu |

**New Config Key Naming (extends `src/shared/config-schema.ts`):**

| Key | Type | Default |
|---|---|---|
| `theme` | `string` | `'tokyo-night'` |
| `acrylicBlur` | `boolean` | `false` |
| `window.widthPercent` | `number (20-100)` | `100` |
| `window.monitor` | `'active' \| 'primary' \| number` | `'active'` |
| `tabs.colorPalette` | `string[]` | 6-color accent array |
| `tabs.maxTabs` | `number (1-20)` | `10` |

### Structure Patterns (Phase 2 Extensions)

**Tab state in renderer — `TabStore` class pattern:**
Same sync-layer class pattern as v1 `ConfigStore`:
```typescript
class TabStore {
  tabs = signal<TabSession[]>([]);
  activeTabId = signal<string | null>(null);
  splitPairs = signal<Map<string, string>>(new Map()); // primaryId → splitId
  // IPC event listeners set up in constructor
}
```

**Theme hot-reload pattern:**
1. `renderer ThemeStore` listens for `theme:changed` main→renderer event
2. On event: updates `@preact/signals` `activeTheme` signal
3. `ThemeStyleInjector` component (sole consumer of signal) updates `:root` custom properties
4. Each active `TerminalView` reads the signal and calls `terminal.options.theme = newXtermTheme`
5. xterm.js re-renders on next frame — no full component remount

**Pane resize debounce (split divider):**
- `SplitDivider` fires `terminal:resize` IPC only on `mouseup` (same as v1 window resize: fire-on-complete, not fire-on-move)
- During drag: CSS flex-basis changes only; xterm.js holds stale dimensions
- On mouseup: call `terminal:resize` for both PTY sessions in the split pair

### Format Patterns (Phase 2 Extensions)

**`tab:data` payload (replaces v1 `terminal:data`):**
```typescript
// Old (v1)
onTerminalData({ data: string })

// New (v2) — tabId added; breaking IPC change, handled in Phase 2 migration
onTerminalData({ tabId: string, data: string })
```
> **Migration note:** v1 had a single implicit session. The renderer's `TerminalView` must be updated to route data by `tabId`. This is the only breaking IPC change in Phase 2.

**Theme definition file format (`themes/*.json`):**
```json
{
  "id": "tokyo-night",
  "name": "Tokyo Night",
  "xtermTheme": {
    "background": "#1a1b26",
    "foreground": "#c0caf5",
    "cursor": "#7aa2f7",
    "...": "all 16 ANSI colors"
  },
  "chromeTokens": {
    "bgTerminal": "#1a1b26",
    "bgChrome": "#13141c",
    "fgPrimary": "#c0caf5",
    "fgDimmed": "#565f89",
    "accent": "#7aa2f7",
    "border": "#2a2b3d"
  }
}
```

### Enforcement Guidelines (Phase 2 Additions)

All v1 rules remain. Additionally, all AI agents MUST:

8. Route all terminal data events by `tabId` — never assume a single global PTY session
9. Use `TabManager` (not `TerminalManager` directly) for all tab/session creation
10. Store theme colors in `ThemeDefinition.chromeTokens` — never hardcode color values in component CSS
11. Check `channels.ts` for `tab:` and `theme:` channels before creating new ones
12. Apply theme changes atomically: xterm ITheme + CSS custom properties in the same IPC event handler, before the next frame
13. Register all new config keys in `config-schema.ts` with `.default()` — never access `config` keys not in the Zod schema

**Anti-patterns (Phase 2 additions):**
- ❌ Storing `splitRatio` in main process or persisted config — it's renderer-only, ephemeral
- ❌ Using tab index (0, 1, 2...) as session key — use UUID tab IDs
- ❌ Hardcoding colors in CSS that belong to theme tokens — always use `var(--accent)` etc.
- ❌ Writing to HKLM for context menu — user scope (HKCU) only, no admin elevation
- ❌ Direct xterm.js theme mutation without going through `ThemeEngine` IPC channel

---

## Project Structure & Boundaries

### Phase 2 Requirements → Module Mapping

| Feature | Primary Location |
|---|---|
| Multi-tab sessions | `src/main/tab-manager.ts` + `src/renderer/components/TabBar/` + `src/renderer/state/tab-store.ts` |
| Split pane | `src/renderer/components/SplitPane/` (renderer-only layout) |
| Theme engine | `src/main/theme-engine.ts` + `src/renderer/state/theme-store.ts` + `themes/` |
| Multi-shell per tab | `src/main/tab-manager.ts` (TabSession.shellType) + `src/renderer/components/Settings/` |
| Settings GUI | `src/renderer/components/Settings/SettingsPanel.tsx` (extended) |
| Dimensions config | `src/main/window-manager.ts` (extended) + `src/shared/config-schema.ts` |
| Acrylic blur | `src/main/window-manager.ts` (extended) |
| Context menu | `src/main/context-menu-installer.ts` + `src/main/app-lifecycle.ts` (Squirrel hooks) |
| Scoop / Winget | `.github/workflows/` + `scripts/` (no `src/` changes) |

### Complete Phase 2 Project Directory Structure

_New files marked `★`. Modified files marked `△`. Unchanged files omitted for brevity._

```
quakeshell/
├── .github/
│   └── workflows/
│       ├── ci.yml                          (unchanged)
│       └── release.yml                  ★  # Scoop + Winget manifest generation
├── scripts/
│   └── generate-scoop-manifest.js       ★  # Reads package.json, writes bucket manifest JSON
├── themes/                              ★  # Bundled theme definitions
│   ├── tokyo-night.json                 ★  # Default theme (matches v1 colors)
│   ├── retro-green.json                 ★  # CRT green-on-black
│   └── solarized-dark.json              ★  # Community-ready example
├── src/
│   ├── main/
│   │   ├── index.ts                     △  # Init TabManager, ThemeEngine, ContextMenuInstaller
│   │   ├── app-lifecycle.ts             △  # Add Squirrel hook → context menu register/unregister
│   │   ├── app-lifecycle.test.ts        △
│   │   ├── window-manager.ts            △  # Add acrylicBlur, widthPercent, monitor selection
│   │   ├── window-manager.test.ts       △
│   │   ├── terminal-manager.ts          △  # Becomes PTY utility; tab-aware spawn/write/resize
│   │   ├── terminal-manager.test.ts     △
│   │   ├── tab-manager.ts               ★  # Map<tabId, TabSession>; create/close/switch/rename/cwd-poll
│   │   ├── tab-manager.test.ts          ★
│   │   ├── theme-engine.ts              ★  # Load bundled + user themes; apply on config change
│   │   ├── theme-engine.test.ts         ★
│   │   ├── context-menu-installer.ts    ★  # HKCU registry write/delete for Explorer integration
│   │   ├── context-menu-installer.test.ts ★
│   │   ├── config-store.ts              △  # Schema extended; no logic changes
│   │   ├── config-store.test.ts         △
│   │   ├── hotkey-manager.ts            (unchanged)
│   │   ├── tray-manager.ts              △  # Add "Open Settings" item to context menu
│   │   ├── notification-manager.ts      (unchanged)
│   │   └── ipc-handlers.ts              △  # Register all new tab: theme: app: channels
│   ├── renderer/
│   │   ├── index.html                   (unchanged)
│   │   ├── index.tsx                    △  # Init TabStore, ThemeStore; inject ThemeStyleInjector
│   │   ├── global.css                   △  # CSS vars become dynamic (ThemeStyleInjector writes :root)
│   │   ├── components/
│   │   │   ├── App.tsx                  △  # Tab-aware layout: TabBar + active pane(s) + overlays
│   │   │   ├── App.module.css           △
│   │   │   ├── Terminal/
│   │   │   │   ├── TerminalView.tsx     △  # Accepts tabId prop; subscribes to tab-specific data events
│   │   │   │   └── TerminalView.module.css (unchanged)
│   │   │   ├── TabBar/                  ★  # New component tree
│   │   │   │   ├── TabBar.tsx           ★  # Container: tab list + new-tab button + settings button
│   │   │   │   ├── TabBar.module.css    ★
│   │   │   │   ├── TabItem.tsx          ★  # Individual tab: color dot + name + close × ; drag-to-reorder
│   │   │   │   ├── TabItem.module.css   ★
│   │   │   │   ├── NewTabButton.tsx     ★  # + button; creates tab via tab:create channel
│   │   │   │   └── SettingsButton.tsx   ★  # ⚙ button; fires window:open-settings
│   │   │   ├── SplitPane/               ★  # New component tree
│   │   │   │   ├── SplitPane.tsx        ★  # Wraps two TerminalViews + SplitDivider
│   │   │   │   ├── SplitPane.module.css ★
│   │   │   │   └── SplitDivider.tsx     ★  # Draggable vertical divider with col-resize affordance
│   │   │   ├── Settings/
│   │   │   │   ├── SettingsPanel.tsx    △  # Becomes full overlay with sectioned tabs
│   │   │   │   ├── SettingsPanel.module.css △
│   │   │   │   ├── HotkeyInput.tsx      (unchanged)
│   │   │   │   ├── ShellSelector.tsx    △  # Extended for cmd + Git Bash options
│   │   │   │   ├── OpacitySlider.tsx    (unchanged)
│   │   │   │   ├── ThemeSelector.tsx    ★  # Theme grid with live preview swatches
│   │   │   │   ├── FontConfig.tsx       ★  # Font family input + size slider
│   │   │   │   ├── MonitorSelector.tsx  ★  # active / primary / by-index selector
│   │   │   │   └── AcrylicToggle.tsx    ★  # Win11 22H2+ only; hidden on older OS
│   │   │   ├── Onboarding/
│   │   │   │   └── OnboardingOverlay.tsx  (unchanged)
│   │   │   ├── Notification/
│   │   │   │   └── ToastNotification.tsx  (unchanged)
│   │   │   └── ThemeStyleInjector.tsx   ★  # Reads ThemeStore signal; writes :root custom properties
│   │   └── state/
│   │       ├── config-store.ts          (unchanged)
│   │       ├── window-store.ts          △  # Add activeTabId, monitorInfo signals
│   │       ├── terminal-store.ts        △  # Becomes tab-aware; keyed by tabId
│   │       ├── tab-store.ts             ★  # TabStore: tabs[], activeTabId, splitPairs signals
│   │       └── theme-store.ts           ★  # ThemeStore: availableThemes[], activeTheme signals
│   ├── shared/
│   │   ├── channels.ts                  △  # Add all tab: theme: app: channel constants
│   │   ├── config-schema.ts             △  # Additive new keys with .default()
│   │   ├── config-types.ts              △  # TabSession, ThemeDefinition, Shell enum (add Cmd, GitBash)
│   │   ├── ipc-types.ts                 △  # Tab, Pane, Theme payload types
│   │   └── constants.ts                 △  # Tab color palette, theme IDs, maxTabs default
│   └── preload/
│       └── index.ts                     △  # Expose new tab: theme: app: channels via contextBridge
├── e2e/
│   ├── toggle.test.ts                   (unchanged)
│   ├── onboarding.test.ts               (unchanged)
│   ├── config-persistence.test.ts       (unchanged)
│   ├── tab-management.test.ts           ★  # Create/close/switch/rename tabs E2E
│   ├── split-pane.test.ts               ★  # Split + resize + close pane E2E
│   ├── theme-switching.test.ts          ★  # Apply bundled theme; verify xterm + chrome colors
│   └── playwright.config.ts             (unchanged)
├── forge.config.ts                      △  # No new makers; may add afterPackHook for context menu test
├── package.json                         △  # No new runtime deps required (simple-git deferred — using execSync)
└── tsconfig.json                        (unchanged)
```

### Integration Boundaries (Phase 2)

**Main Process Boundary Extensions:**

| Module | Responsible For | NOT Responsible For |
|---|---|---|
| `TabManager` | Session lifecycle (create/kill/cwd-poll); routing PTY I/O by tabId | Rendering; split layout; divider ratio |
| `ThemeEngine` | Loading theme JSON; validating schema; firing `theme:changed` event | Applying CSS vars (renderer job); xterm API calls (renderer job) |
| `ContextMenuInstaller` | HKCU registry write/delete; responding to `app:register-context-menu` | CLI arg parsing (`app-lifecycle.ts` handles `--cwd`) |
| `WindowManager` | BrowserWindow acrylic + width + monitor selection | Tab-level focus (TabStore owns activeTabId) |

**Renderer Boundary Extensions:**

| Module | Responsible For | NOT Responsible For |
|---|---|---|
| `TabBar` + `TabItem` | Visual tab representation; drag-reorder; + and ⚙ buttons | Creating PTY sessions (IPC to TabManager) |
| `SplitPane` | Layout of two TerminalViews + SplitDivider; divider drag math | Which sessions are split (TabStore owns splitPairs) |
| `ThemeStyleInjector` | Writing `:root` CSS custom properties | Loading themes (ThemeEngine) or storing active theme (ThemeStore) |
| `Settings/SettingsPanel` | All user-facing config editing via existing IPC | Config persistence (main process ConfigStore) |

---

## Architecture Validation

### Coherence Validation

**v1 invariants preserved:**

| Invariant | How Phase 2 Preserves It |
|---|---|
| Hide ≠ Close | `tab:close` is distinct from window hide; `app.hide()` never kills PTY sessions |
| <100ms toggle | Tab bar is rendered HTML (not OS chrome); show/hide path in WindowManager unchanged |
| Hot-reload config | All new config keys have `onConfigChange` handlers; ThemeEngine subscribes to config changes |
| IPC security | All new channels registered in `channels.ts`; exposed via contextBridge in `preload/index.ts` |
| <80MB idle | Single tab at idle ≈ v1; multi-tab RAM grows only when tabs are open; not a startup regression |

**Decision compatibility:**

| Decision Pair | Compatible? | Notes |
|---|---|---|
| TabManager (P2-1) + SplitPane (P2-4) | ✅ | Split = 2 TabSessions; TabManager is unaware of layout |
| ThemeEngine (P2-2) + CSS Modules (v1) | ✅ | ThemeStyleInjector writes `:root`; CSS Modules use `var()` references |
| Config schema (P2-3) + Zod safeParse (v1) | ✅ | Additive `.default()` — existing parse logic unchanged |
| Acrylic (P2-6) + Opacity config (v1) | ✅ | Acrylic replaces opacity rendering; config value still stored; fallback restores opacity |
| Context menu (P2-7) + Single instance (v1) | ✅ | `--cwd` arg processed in `got-second-lock` handler; single instance enforced first |
| Tab auto-naming (P2-8) + Hide-is-not-close (v1) | ✅ | Name polling stops when terminal is hidden; resumes on show |

### Requirements Coverage

| Phase 2 Feature | Architecture Coverage |
|---|---|
| Multi-tab sessions | P2-1 (TabManager), TabBar components, TabStore |
| Split-pane | P2-4 (SplitPane, SplitDivider), TabManager split-session pairs |
| Theming engine | P2-2 (ThemeEngine), ThemeStore, ThemeStyleInjector, `themes/` directory |
| Multi-shell per tab | P2-1 (TabSession.shellType), ShellSelector extension |
| Custom colors & fonts | P2-2 (ThemeDefinition.xtermTheme), FontConfig component, config-schema extension |
| Terminal dimensions config | P2-3 (widthPercent, monitor config), WindowManager extension |
| Scoop + Winget | P2-9 (CI manifests, no src/ changes) |
| Shell context menu | P2-7 (ContextMenuInstaller, Squirrel hooks) |
| Settings GUI | P2-5 (SettingsPanel overlay, existing IPC) |
| Acrylic blur | P2-6 (WindowManager, OS version check) |

### Gap Analysis

**No critical gaps identified.**

**Important items to address during implementation:**

1. **Breaking IPC change in `terminal:data` → `tab:data`:** The renderer's `TerminalView.tsx` and `terminal-store.ts` must be updated atomically with the IPC handler change. Implement as a single story to prevent partial state where v1 renderer talks to v2 main.

2. **Tab session persistence across restarts:** Phase 2 architecture does not persist open tab sessions across app restart (tabs are in-memory only). This is intentional for Phase 2 — session restore is Phase 3. Document this explicitly in the Settings panel.

3. **maxTabs enforcement:** `TabManager.createTab()` must reject when `tabs.length >= config.tabs.maxTabs` and return an error via IPC. The renderer must handle this gracefully (show a notification, not a crash).

4. **`--cwd` single instance flow:** When `--cwd <path>` is passed to a second QuakeShell instance, the single-instance lock sends the argv to the first instance via `app.requestSingleInstanceLock()`. The first instance must then call `TabManager.createTab({ cwd: parsedPath })` and show the window. The flow must be tested end-to-end before context menu ships.

**Nice-to-have (deferred to Phase 3):**
- Tab session restore across app restarts
- Tab drag-between-windows (Phase 3 multi-window)
- Light theme support (requires evaluating terminal readability at high opacity)
- ARM64 Windows build

### Implementation Readiness Assessment

✅ All Phase 2 features have clear architectural homes
✅ v1 patterns (IPC, naming, structure, security) carry forward without migration
✅ Config schema extension is non-breaking — v1 configs load cleanly
✅ One intentional breaking IPC change (`terminal:data` → `tab:data`) is isolated and documented
✅ New modules follow v1 module structure (kebab-case files, scoped loggers, co-located tests, named exports)
✅ Distribution (Scoop/Winget) is CI-only — zero runtime risk
✅ Acrylic blur is opt-in with graceful fallback — no regression on Windows 10
✅ Context menu uses HKCU — no admin elevation, no installer changes required
