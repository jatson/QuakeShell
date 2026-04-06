---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-04-06'
inputDocuments:
  - docs/planning-artifacts/prd.md
  - docs/planning-artifacts/product-brief-QuakeShell.md
  - docs/planning-artifacts/product-brief-QuakeShell-distillate.md
  - docs/planning-artifacts/ux-design-specification.md
  - docs/planning-artifacts/ux-design-specification-v3.md
  - docs/planning-artifacts/research/technical-quake-terminal-windows-research-2026-03-31.md
  - docs/planning-artifacts/architecture.md
  - docs/planning-artifacts/architecture-v2.md
workflowType: 'architecture'
project_name: 'QuakeShell'
user_name: 'Barna'
date: '2026-04-06'
---

# Architecture Decision Document - Phase 3

_This document extends the v1 architecture (Phase 1) and v2 architecture (Phase 2) with Phase 3 decisions for multi-protocol sessions, plugin extensibility, profile sharing, cross-platform support, and restart-safe session management._

_Companion UX artifact: `docs/planning-artifacts/ux-design-specification-v3.md` extends the base UX specification with the Phase 3 session launcher, profile library, trust flows, restore behavior, plugin dock, and cross-platform interaction rules assumed by this architecture._

---

## Project Context Analysis

### Requirements Overview

**Phase 3 Functional Scope (from PRD Phase 3 and carried-forward Phase 2 gaps):**

| Feature Area | Requirements |
|---|---|
| Multi-protocol sessions | SSH interactive shells, telnet sessions, and serial device sessions must behave like first-class terminal sessions with connect, disconnect, resize, reconnect, and status reporting |
| Plugin architecture | QuakeShell must load custom extensions that contribute commands, panels, and background services without giving plugins unrestricted Electron or Node access |
| Cross-platform support | The existing Windows-first Electron app must run on macOS and Linux while preserving the same drop-down interaction model, tray/dock presence, notifications, and local shell workflows |
| Profiles and sharing | Users need named local and remote profiles that can be exported, imported, and shared without leaking passwords, keys, or host trust material |
| Built-in power features | Git visual integration, SFTP browsing, and log viewing should ship as plugins that prove the extension model instead of bloating core modules |
| Session management | Tabs, split panes, active profiles, and plugin panel state must survive app restart through realistic reopen semantics and reconnect policies |

**Phase 2 invariants that remain non-negotiable:**

- Drop-down terminal UX stays primary. New protocols and plugins cannot turn the app into a general-purpose window manager.
- Hide is not close while the app is running. Hiding the window never destroys active session state.
- The typed IPC boundary remains mandatory. Main, preload, renderer, and plugin code communicate only through declared channels and typed payloads.
- Existing tab, split-pane, theme, and settings systems remain the renderer foundation. Phase 3 extends them instead of replacing them.
- The current Windows npm-first distribution path remains the production baseline for Windows even as macOS and Linux packaging are added.

**Scale & Complexity:**

- Complexity level: Medium-high
- Primary domain: Desktop terminal platform
- New architectural components: `SessionManager`, transport adapters, `ProfileStore`, `SecretVault`, `PluginManager`, utility-process plugin host, and platform adapters
- No backend or cloud services are introduced. Complexity comes from local process orchestration, secret handling, and cross-platform OS integration.

### Technical Constraints & Dependencies

- **Current application foundation:** Electron 41.1.0, Node 24, Preact 10.29.0, `@preact/signals` 2.9.0, `node-pty` 1.1.0, `electron-store` 11.0.2, and the existing Forge + Vite packaging pipeline
- **SSH library:** `ssh2` 1.17.0 is current and supports interactive shells, SFTP, agent integration, host verification hooks, and port forwarding primitives in pure JavaScript
- **Serial library:** `serialport` 13.0.0 is current, TypeScript-ready, and explicitly supports Windows, macOS, and Linux bindings
- **Telnet library:** `telnet-client` 2.2.13 is current and TypeScript-ready, but telnet remains an insecure protocol and must be disabled by default unless the user explicitly opts in per profile
- **Plugin isolation primitive:** Electron `utilityProcess` is available in the main process and supports typed message passing, stdout/stderr piping, and per-process naming after `app` is ready
- **Secret storage constraint:** Saved credentials and private material cannot live in plain JSON. Cross-platform persistence must route through Electron `safeStorage`, with graceful fallback when encryption is unavailable
- **Packaging constraint:** The current package manifest still declares `os: [win32]` and a Windows-only npm launcher. Cross-platform support must relax those limits deliberately instead of breaking the existing Windows release flow
- **Platform behavior constraint:** WSL remains Windows-only, Explorer context menus stay Windows-only, and macOS/Linux equivalents must be isolated behind platform services instead of leaking platform branching into feature modules
- **Release engineering constraint:** Public macOS builds will require signing and notarization; Linux builds require distro-specific validation even though Forge already provides `zip`, `deb`, and `rpm` makers in this repository

### Cross-Cutting Concerns

1. **Session identity vs. tab identity** - Phase 2 binds tab UI closely to session lifecycle. Phase 3 must separate layout state from transport state so local, SSH, telnet, serial, and plugin-backed sessions can all participate in the same tab system.
2. **Secret storage and host trust** - Saved profiles are now security-sensitive. Credentials, private keys, passphrases, and SSH host verification cannot be treated like normal settings.
3. **Plugin isolation and permissions** - Plugins must be powerful enough for SFTP, Git, and log tooling without becoming a bypass around the hardened Electron boundary.
4. **Platform service boundaries** - Cross-platform support introduces OS-specific shell discovery, autostart, tray/dock behavior, notifications, filesystem conventions, and packaging differences. Those branches must live in one place.
5. **Session restore and reconnect** - Phase 3 promises durable workflows, but local shell processes cannot be literally resumed after app exit. The architecture must distinguish true in-memory continuity from restart-time reopen behavior.
6. **Encoding and byte-stream fidelity** - `node-pty`, SSH channels, telnet sockets, and serial devices do not all emit the same data shape. Core transport contracts must preserve bytes and terminal metadata consistently.
7. **Distribution model transition** - The repository already codifies a Windows npm-wrapper release model. Cross-platform support must extend distribution without destabilizing the working Windows channel.

---

## Starter Template Evaluation

**Not applicable - existing project.**

QuakeShell is already implemented on Electron Forge + Vite + TypeScript and has completed Phase 1 and Phase 2 planning artifacts. Phase 3 should extend the current repository instead of re-bootstrapping from a new starter.

### Existing Foundation to Carry Forward

| Existing Foundation | Phase 3 Stance |
|---|---|
| Electron Forge + Vite + TypeScript | Keep. No re-scaffold. Extend the current build and packaging pipeline |
| Preact + `@preact/signals` renderer architecture | Keep. New profile, session, and plugin panels fit the same renderer model |
| Typed preload + `contextBridge` IPC surface | Keep. Plugins and transport modules extend typed IPC rather than bypass it |
| `node-pty`-based local terminal architecture | Keep for local shells. Wrap behind a transport interface instead of letting it remain the only session type |
| Existing `TabManager`, `ThemeEngine`, and settings overlay | Keep as the UI foundation. Refactor boundaries rather than replace working systems |
| Electron Forge makers already present for Windows, macOS zip, Debian, and RPM | Keep and extend. Cross-platform releases build on this existing configuration |

### Phase 3 Runtime Additions Evaluated

| Package / API | Verified Version | Why It Fits |
|---|---|---|
| `ssh2` | 1.17.0 | Interactive shell, exec, SFTP, agent, and host verification support in pure JavaScript |
| `serialport` | 13.0.0 | Cross-platform serial device support with TypeScript declarations |
| `telnet-client` | 2.2.13 | Terminal-oriented telnet support with shell mode and promise-based API; guarded behind explicit opt-in |
| Electron `utilityProcess` | Electron 41 docs support it | Gives QuakeShell an isolated plugin backend runtime with typed message passing |

### Foundation Decision

**Selected foundation:** Continue on the current QuakeShell repository and extend it in place.

**Rationale:**

- The repository already contains Phase 2 code for tabs, splits, themes, settings, context menus, and packaging.
- Cross-platform support is primarily a systems-boundary problem, not a starter-template problem.
- Re-scaffolding would create churn in the exact place the previous architecture artifacts already established strong conventions.

### What the Existing Foundation Does Not Yet Provide

| Missing Capability | Why Phase 3 Must Add It |
|---|---|
| Transport abstraction | Current session code assumes local PTY-backed shells |
| Secure profile and secret handling | Existing config storage is not designed for remote credentials or host trust |
| Plugin runtime and manifest model | Core code has no extension boundary yet |
| Cross-platform service layer | Platform branching is still effectively Windows-first |
| Restart-time session restoration | Phase 2 explicitly deferred tab/session restore to Phase 3 |

**Note:** Phase 3 begins with refactoring toward a transport-oriented session layer, not with a new project initialization command.

---

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (block Phase 3 implementation):**

| # | Decision | Choice |
|---|---|---|
| P3-1 | Session orchestration model | Introduce `SessionManager`; keep `TabManager` as layout-only UI state |
| P3-2 | Transport adapter contract | Standardize all local, SSH, telnet, and serial sessions behind one typed transport interface |
| P3-3 | Profiles, secrets, and host trust | Split profile metadata, encrypted secrets, and host trust into dedicated stores |
| P3-4 | Plugin runtime isolation | Manifest-driven plugins with renderer contributions plus isolated utility-process backends |

**Important Decisions (shape architecture significantly):**

| # | Decision | Choice |
|---|---|---|
| P3-5 | Cross-platform services | Central `PlatformService` with Windows, macOS, and Linux adapters |
| P3-6 | Session restore and reconnect | Persist reopenable snapshots, not impossible process-level resumes |
| P3-7 | Built-in plugin strategy | Ship Git Visual, SFTP Browser, and Log Viewer as first-party plugins using the same plugin API |
| P3-8 | Cross-platform distribution model | Keep Windows npm wrapper; add platform-native release artifacts without breaking Windows flow |

**Deferred Decisions (post-Phase 3):**

| Decision | Rationale for Deferral |
|---|---|
| Public plugin marketplace and signature verification service | Local/plugin-bundle loading is enough for Phase 3; hosted distribution is an ecosystem problem |
| True macOS DMG installer and notarized auto-update flow | Runtime architecture does not depend on it; release engineering can land after cross-platform runtime validation |
| ARM64 parity across all desktop platforms | Useful, but not required to validate the cross-platform architecture itself |
| Remote desktop/X11/file-transfer expansion beyond SFTP | Outside the PRD scope for this phase |

---

### Decision P3-1: Session Orchestration Model

- **Choice:** Introduce a main-process `SessionManager` as the source of truth for all session lifecycles. `TabManager` remains responsible only for tab grouping, split layout, active tab selection, and UI ordering.
- **Session record shape:**

```typescript
interface SessionRecord {
  id: string;
  kind: 'local' | 'ssh' | 'telnet' | 'serial' | 'plugin';
  profileId?: string;
  tabId: string;
  paneId?: string;
  transportId: string;
  state: 'connecting' | 'ready' | 'disconnected' | 'reconnecting' | 'failed';
  restorePolicy: 'never' | 'reopen-last' | 'always';
  metadata: Record<string, unknown>;
}
```

- **Refactor boundary:**
  - `tab-manager.ts` stops owning PTY lifecycle.
  - `terminal-manager.ts` becomes the local shell transport backend used by `SessionManager`.
  - Renderer components route terminal output by `sessionId`, not by the implicit assumptions of a tab-local PTY.
- **Rationale:** Multi-protocol support is the point where layout and transport state diverge. Tabs, splits, reconnect policies, and restart restore all become simpler when the UI references session records instead of owning them.
- **Affects:** `tab-manager.ts`, `terminal-manager.ts`, `ipc-handlers.ts`, renderer `tab-store.ts`, a new renderer `session-store.ts`, and all terminal event payloads

---

### Decision P3-2: Transport Adapter Contract

- **Choice:** Define a common `SessionTransport` contract implemented by local PTY, SSH, telnet, serial, and plugin-backed session types.

```typescript
interface SessionTransport {
  readonly kind: SessionRecord['kind'];
  open(session: SessionRecord): Promise<void>;
  write(sessionId: string, chunk: Uint8Array | string): Promise<void>;
  resize(sessionId: string, cols: number, rows: number): Promise<void>;
  reconnect(sessionId: string): Promise<void>;
  close(sessionId: string): Promise<void>;
  snapshot(sessionId: string): Promise<Record<string, unknown>>;
}
```

- **Concrete adapters:**
  - `LocalPtyTransport` built on `node-pty`
  - `SshTransport` built on `ssh2`
  - `TelnetTransport` built on `telnet-client`
  - `SerialTransport` built on `serialport`
  - `PluginSessionTransport` for plugins that expose custom streaming sessions later
- **Renderer contract:** `session:data` payloads carry `sessionId`, `chunk`, and `encoding` metadata. The renderer terminal service normalizes transport output before handing it to xterm.
- **Security posture:** Telnet profiles are supported because the PRD names telnet, but they are off by default, clearly labeled insecure, and excluded from recommended profile templates.
- **Rationale:** The transport contract fixes the root cause of Phase 2's layout-centric design. It also enables first-party plugins like SFTP to attach to the same session graph instead of inventing special one-off channels.
- **Affects:** New `src/main/sessions/transports/**`, shared session payload types, preload APIs, and renderer terminal/session stores

---

### Decision P3-3: Profiles, Secrets, and Host Trust

- **Choice:** Split connection persistence into three explicit layers:
  1. **`ProfileStore`** for shareable, non-secret profile metadata
  2. **`SecretVault`** for encrypted credentials using Electron `safeStorage`
  3. **`HostTrustStore`** for SSH host fingerprints and trust decisions
- **Profile shape:**

```typescript
interface ConnectionProfile {
  id: string;
  kind: 'local' | 'ssh' | 'telnet' | 'serial';
  name: string;
  connection: Record<string, unknown>;
  terminal: {
    shell?: string;
    cwd?: string;
    themeId?: string;
    encoding?: 'utf8' | 'ascii' | 'latin1';
  };
  restore: {
    autoConnect: boolean;
    reopenOnLaunch: boolean;
  };
  tags: string[];
}
```

- **Secret handling rules:**
  - Passwords, private-key passphrases, and SSH private keys are never stored in plaintext in profile JSON.
  - Exported `.qsprofile.json` bundles exclude secrets by default and carry only `secretRef` metadata.
  - If `safeStorage` is unavailable, QuakeShell stores only non-secret profile metadata and prompts at connect time.
- **Host trust rules:**
  - SSH first-connect flows persist verified host fingerprints in `HostTrustStore`.
  - Profile sharing never exports trusted host fingerprints unless the user explicitly chooses a trusted-internal export mode.
- **Rationale:** Remote access and profile sharing make configuration security-critical. Keeping secrets separate from portable profile metadata prevents the current settings model from becoming a liability.
- **Affects:** New `src/main/profiles/**`, renderer profile screens, IPC types, import/export workflows, and onboarding for remote connections

---

### Decision P3-4: Plugin Runtime Isolation

- **Choice:** Use a manifest-driven plugin model with two contribution surfaces:
  1. **Renderer contributions** loaded as local ESM bundles for commands, panels, and lightweight UI integration
  2. **Backend contributions** executed in an isolated Electron utility process through a typed RPC bridge
- **Plugin manifest shape:**

```json
{
  "id": "git-visual",
  "version": "1.0.0",
  "displayName": "Git Visual",
  "permissions": ["session.read", "workspace.read", "git.read"],
  "contributes": {
    "commands": ["gitVisual.open"],
    "panels": ["gitVisual.panel"]
  }
}
```

- **Permission model:** Plugins declare capabilities such as `session.read`, `session.write`, `filesystem.read`, `filesystem.write`, `git.read`, `sftp.read`, and `notifications.show`. The host grants only those APIs.
- **Isolation rules:**
  - Plugins never receive raw `ipcRenderer`, `ipcMain`, `app`, or `BrowserWindow` access.
  - Backend plugins communicate with the main process through `MessagePortMain` and typed RPC envelopes.
  - Renderer plugin code gets only a sandboxed host API object and cannot import core application internals directly.
- **Rationale:** This gives QuakeShell a real extension system without punching holes in the security model established in Phase 1.
- **Affects:** New `src/main/plugin-host/**`, `src/shared/plugin-*.ts`, plugin bundle discovery, preload APIs, renderer plugin slots, and build configuration for plugin entrypoints

---

### Decision P3-5: Cross-Platform Service Layer

- **Choice:** Add a `PlatformService` abstraction in the main process with dedicated Windows, macOS, and Linux adapters.
- **Responsibilities:**
  - Local shell discovery and defaults
  - Autostart behavior
  - Tray vs dock conventions
  - Native notification integration
  - Filesystem/path conventions for configs, themes, plugins, and profiles
  - Platform feature availability (for example, WSL and Explorer context menus on Windows only)
- **Local shell rules:**
  - Windows: `pwsh.exe`, `wsl.exe`, `cmd.exe`, Git Bash if installed
  - macOS: user login shell from `$SHELL`, fallback to `/bin/zsh`
  - Linux: user login shell from `$SHELL`, fallback to `/bin/bash`
- **Rationale:** Cross-platform support fails quickly when `process.platform` checks spread across many modules. A single platform boundary keeps the rest of the app transport- and UI-focused.
- **Affects:** `app-lifecycle.ts`, `window-manager.ts`, autostart handling, local profile templates, notification routing, and package/release configuration

---

### Decision P3-6: Session Restore and Reconnect Policy

- **Choice:** Persist `SessionSnapshot` and layout state for restart-time reopen behavior, not impossible process-level suspension.
- **Restore semantics:**
  - **Local shells:** reopened from profile, cwd, and optional launch command snapshot; marked as restarted rather than resumed
  - **SSH / telnet / serial:** reconnect according to per-profile policy (`manual`, `prompt`, `automatic`)
  - **Plugin panels:** restored from panel state snapshots when the backing plugin is available
- **Persistence scope:** active tab order, split pairs, selected profile, last known working directory, session title, reconnect policy, and visible plugin panels
- **Rationale:** Phase 2 explicitly deferred restore. Phase 3 should close that gap with realistic behavior that users can rely on across operating systems.
- **Affects:** `SessionManager`, new session persistence module, renderer `session-store.ts`, tab restore logic, and onboarding/settings UX for restore policies

---

### Decision P3-7: First-Party Plugins Dogfood the Plugin API

- **Choice:** Ship `git-visual`, `sftp-browser`, and `log-viewer` as first-party plugins under the same manifest and permission system used for third-party plugins.
- **Plugin roles:**
  - **Git Visual:** reads repo status, branches, diffs, and staged state for the active workspace or tab cwd
  - **SFTP Browser:** uses the active SSH session or an SSH profile to browse, upload, and download remote files
  - **Log Viewer:** tails files or session output streams in a structured plugin panel
- **Rationale:** The fastest way to prove the plugin system is to build QuakeShell's own advanced features on top of it. If core-only code is allowed to cheat, third-party plugin architecture will rot immediately.
- **Affects:** New `plugins/builtin/**`, plugin registry bootstrapping, built-in plugin tests, and renderer/plugin host integration

---

### Decision P3-8: Cross-Platform Distribution Model

- **Choice:** Preserve the current Windows npm-wrapper release flow while extending release artifacts for macOS and Linux.
- **Distribution rules:**
  - Windows keeps the `quakeshell` npm wrapper and Squirrel installer flow.
  - macOS and Linux ship as release artifacts first (`zip`, `deb`, `rpm`), not as pretend npm binaries.
  - The core app removes hard Windows-only package gating only after cross-platform smoke tests pass.
  - If npm convenience is later desired on macOS/Linux, it should use platform-specific wrapper packages instead of one misleading universal package.
- **Rationale:** The repository memory already captures that npm-first, Windows-only distribution is intentional today. Phase 3 should grow beyond it without breaking the installed Windows path.
- **Affects:** `package.json`, npm wrapper scripts, release workflows, Forge makers, documentation, and update-check logic

---

### Decision Impact Analysis

**Implementation Sequence:**

1. Introduce `SessionManager` and the transport contract while keeping the current local PTY path working
2. Add `ProfileStore`, `SecretVault`, and `HostTrustStore` so remote sessions have safe persistence primitives
3. Migrate renderer terminal flows from tab-centric to session-centric payloads
4. Add `PlatformService` to centralize cross-platform branching before Linux/macOS features land
5. Add plugin host and manifest validation, then ship first-party plugins on top of it
6. Implement session restore/reconnect once the session graph and profile model are stable
7. Extend release configuration and documentation for macOS/Linux artifacts

**Cross-Component Dependencies:**

| Decision | Depends On | Depended By |
|---|---|---|
| Session orchestration (P3-1) | Existing tab/layout system | Restore, plugins, profile launch, all transports |
| Transport contract (P3-2) | Session orchestration | SSH/SFTP, telnet, serial, plugin sessions |
| Profiles/secrets/trust (P3-3) | None | Session creation, reconnect, sharing, SSH flows |
| Plugin runtime (P3-4) | Typed IPC and utility process support | Built-in plugins, third-party plugins, docked panels |
| Platform service (P3-5) | Existing Electron foundation | Local shell discovery, packaging, notifications, autostart |
| Restore/reconnect (P3-6) | Sessions + profiles | Session continuity UX, startup flows |
| First-party plugins (P3-7) | Plugin runtime + sessions + profiles | Git/SFTP/log power features |
| Distribution model (P3-8) | Platform service | Public cross-platform release process |

---

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical conflict points identified:** 8 areas where different agents would otherwise make incompatible choices: session IDs, profile formats, plugin manifests, transport payloads, platform branching, secret handling, plugin permissions, and restore semantics.

### Naming Patterns

**Session and profile naming conventions:**

| Element | Convention | Example |
|---|---|---|
| Session IDs | UUID strings | `0a8d9a5d-5ab8-4f19-a8f7-6e0c4ccfcf15` |
| Profile IDs | Kebab-case, stable, user-visible in exports | `prod-eu-ssh`, `local-zsh`, `usb-console-router` |
| Plugin IDs | Reverse-DNS or kebab-case package IDs | `quakeshell.git-visual`, `sftp-browser` |
| Permission names | `namespace.capability` | `session.read`, `filesystem.write`, `git.read` |
| Session kinds | Lowercase string literals | `local`, `ssh`, `telnet`, `serial`, `plugin` |

**Code and file naming extensions:**

| Context | Convention | Example |
|---|---|---|
| Session/transport modules | `kebab-case.ts` | `session-manager.ts`, `ssh-transport.ts` |
| Renderer components | `PascalCase.tsx` | `ProfilesPanel.tsx`, `PluginPanelHost.tsx` |
| Shared schemas/types | `kebab-case.ts` | `profile-schema.ts`, `plugin-manifest-schema.ts` |
| Plugin folders | Kebab-case plugin ID | `plugins/builtin/git-visual/` |
| Test files | Co-located `{name}.test.ts(x)` | `session-manager.test.ts`, `ProfilesPanel.test.tsx` |

**IPC channel naming:**

| Namespace | Examples |
|---|---|
| `session:*` | `session:create`, `session:write`, `session:resize`, `session:data`, `session:status-changed` |
| `profile:*` | `profile:list`, `profile:save`, `profile:delete`, `profile:export` |
| `plugin:*` | `plugin:list`, `plugin:enable`, `plugin:disable`, `plugin:command`, `plugin:event` |
| `platform:*` | `platform:capabilities`, `platform:open-path` |

### Structure Patterns

**Main-process organization rules:**

- All transport implementations live under `src/main/sessions/transports/`.
- All profile, secret, and host-trust persistence lives under `src/main/profiles/`.
- All plugin lifecycle, permission, and host-bridge code lives under `src/main/plugin-host/`.
- All OS-specific branching lives under `src/main/platform/`.
- `ipc-handlers.ts` remains the only file that registers IPC handlers. Session, profile, plugin, and platform modules do not touch `ipcMain` directly.

**Renderer organization rules:**

- Renderer stores remain the only layer that calls the preload API.
- Terminal rendering components consume `sessionId`, never transport-specific objects.
- Plugin panel hosts render contributions by manifest ID and never import plugin source directly from core app code.
- Profile editors, secret prompts, and connection wizards live under dedicated renderer feature folders instead of being mixed into the existing settings form.

### Format Patterns

**Session event payload format:**

```typescript
onSessionData({
  sessionId: string,
  chunk: Uint8Array,
  encoding: 'utf8' | 'ascii' | 'latin1' | 'binary',
});

onSessionStatusChanged({
  sessionId: string,
  state: 'connecting' | 'ready' | 'disconnected' | 'reconnecting' | 'failed',
  errorCode?: string,
});
```

**Profile export format:**

```json
{
  "schemaVersion": 1,
  "profiles": [],
  "includesSecrets": false,
  "includesHostTrust": false
}
```

- Exported profile bundles always use camelCase JSON fields.
- Secret material is excluded by default.
- The export schema is versioned explicitly so future migrations do not rely on guesswork.

**Plugin RPC envelope:**

```typescript
interface PluginRpcEnvelope {
  requestId: string;
  pluginId: string;
  method: string;
  payload: unknown;
}
```

- Every plugin request and response includes `pluginId` and `requestId`.
- No positional RPC arguments. Payloads are always objects.
- Permission denials return typed error codes, not ad hoc strings.

### Communication Patterns

**State management rules:**

- `session-store.ts` mirrors session state from main and is the only renderer authority on connection status.
- `tab-store.ts` owns only layout references (`tabId`, `splitPairs`, selected tab), not transport objects.
- `profile-store.ts` owns only non-secret profile metadata in renderer state.
- `plugin-store.ts` tracks plugin enablement, panels, and command registrations, but plugin backends stay outside the renderer process.

**Plugin host communication rules:**

- Utility-process backends communicate through typed message ports only.
- Renderer plugin panels call manifest-registered commands through the core plugin store/preload API.
- Plugins never call `window.quakeshell` directly unless the host has explicitly exposed a scoped plugin API wrapper.

### Process Patterns

**Secret handling patterns:**

- Renderer prompts for secrets only long enough to submit them to main.
- Decrypted secrets never persist in renderer signals, component props, or exported profile files.
- All persisted secret writes go through `SecretVault`.

**Reconnect and restore patterns:**

- Reconnect policies are always explicit per profile.
- Local sessions restore via reopen semantics, not fake process resume claims.
- Session restore snapshots are written only on meaningful state changes, not on every output chunk.

**Error handling patterns:**

- Transport errors map to shared error codes such as `SSH_AUTH_FAILED`, `SSH_HOST_KEY_MISMATCH`, `TELNET_DISABLED`, `SERIAL_PORT_BUSY`, and `PLUGIN_PERMISSION_DENIED`.
- Renderer code displays user-facing messages from typed error metadata, not raw library error strings.
- Plugins receive sanitized error payloads, never raw stack traces from main by default.

### Enforcement Guidelines

**All AI agents MUST:**

1. Use `SessionManager` for lifecycle changes and `TabManager` for layout changes. Never conflate the two.
2. Keep all platform-specific branching inside `src/main/platform/**`.
3. Persist secrets only through `SecretVault`; never write credentials into `electron-store` profile JSON directly.
4. Register every plugin permission in shared capability constants before using it.
5. Route all plugin backend work through the plugin host bridge; do not import plugin backend code into main-process core modules.
6. Preserve typed object payloads for all `session:*`, `profile:*`, and `plugin:*` channels.
7. Treat telnet as insecure-by-default in UI copy, defaults, and tests.

**Anti-patterns:**

- Direct `ssh2`, `serialport`, or `telnet-client` usage from renderer code
- Using `tabId` as the primary identifier for session lifecycle
- Storing passwords, private keys, or passphrases in shareable profile files
- Scattering `process.platform` checks across feature modules
- Letting plugins import `ipcRenderer`, `ipcMain`, or `BrowserWindow`
- Coupling built-in Git, SFTP, or log tooling directly into core renderer components instead of the plugin system

---

## Project Structure & Boundaries

### Phase 3 Requirements -> Module Mapping

| Feature | Primary Location |
|---|---|
| Multi-protocol sessions | `src/main/sessions/` + `src/renderer/state/session-store.ts` + `src/renderer/components/Terminal/` |
| Profiles and sharing | `src/main/profiles/` + `src/renderer/components/Profiles/` |
| Plugin runtime | `src/main/plugin-host/` + `src/renderer/components/Plugins/` + `plugins/` |
| Cross-platform services | `src/main/platform/` |
| Session restore/reconnect | `src/main/sessions/session-persistence.ts` + renderer startup/bootstrap |
| Built-in Git/SFTP/log tools | `plugins/builtin/` |

### Complete Phase 3 Project Directory Structure

_New files marked `★`. Modified files marked `△`. Unchanged files omitted when they do not materially affect Phase 3._

```text
quakeshell/
├── plugins/                                   ★
│   ├── builtin/                               ★
│   │   ├── git-visual/                        ★
│   │   │   ├── manifest.json                  ★
│   │   │   ├── main.ts                        ★
│   │   │   ├── renderer.tsx                   ★
│   │   │   └── styles.module.css              ★
│   │   ├── sftp-browser/                      ★
│   │   │   ├── manifest.json                  ★
│   │   │   ├── main.ts                        ★
│   │   │   ├── renderer.tsx                   ★
│   │   │   └── styles.module.css              ★
│   │   └── log-viewer/                        ★
│   │       ├── manifest.json                  ★
│   │       ├── main.ts                        ★
│   │       ├── renderer.tsx                   ★
│   │       └── styles.module.css              ★
│   └── schemas/                               ★
│       └── plugin-manifest.schema.json        ★
├── src/
│   ├── main/
│   │   ├── index.ts                           △  # Bootstrap SessionManager, PlatformService, PluginManager
│   │   ├── app-lifecycle.ts                   △  # Cross-platform startup, restore, second-instance argv handling
│   │   ├── window-manager.ts                  △  # Platform-aware behavior, plugin panel docking boundaries
│   │   ├── terminal-manager.ts                △  # Reduced to local PTY transport backend
│   │   ├── tab-manager.ts                     △  # Layout only; references sessionId instead of owning PTY lifecycle
│   │   ├── ipc-handlers.ts                    △  # Register new session/profile/plugin/platform channels
│   │   ├── platform/                          ★
│   │   │   ├── platform-service.ts            ★
│   │   │   ├── windows-platform.ts            ★
│   │   │   ├── macos-platform.ts              ★
│   │   │   ├── linux-platform.ts              ★
│   │   │   └── platform-service.test.ts       ★
│   │   ├── sessions/                          ★
│   │   │   ├── session-manager.ts             ★
│   │   │   ├── session-manager.test.ts        ★
│   │   │   ├── session-persistence.ts         ★
│   │   │   ├── session-persistence.test.ts    ★
│   │   │   ├── session-registry.ts            ★
│   │   │   ├── session-registry.test.ts       ★
│   │   │   └── transports/                    ★
│   │   │       ├── transport.ts               ★
│   │   │       ├── local-pty-transport.ts     ★
│   │   │       ├── local-pty-transport.test.ts ★
│   │   │       ├── ssh-transport.ts           ★
│   │   │       ├── ssh-transport.test.ts      ★
│   │   │       ├── telnet-transport.ts        ★
│   │   │       ├── telnet-transport.test.ts   ★
│   │   │       ├── serial-transport.ts        ★
│   │   │       └── serial-transport.test.ts   ★
│   │   ├── profiles/                          ★
│   │   │   ├── profile-store.ts               ★
│   │   │   ├── profile-store.test.ts          ★
│   │   │   ├── secret-vault.ts                ★
│   │   │   ├── secret-vault.test.ts           ★
│   │   │   ├── host-trust-store.ts            ★
│   │   │   ├── host-trust-store.test.ts       ★
│   │   │   ├── profile-exporter.ts            ★
│   │   │   └── profile-exporter.test.ts       ★
│   │   ├── plugin-host/                       ★
│   │   │   ├── manager.ts                     ★
│   │   │   ├── manager.test.ts                ★
│   │   │   ├── entry.ts                       ★  # utilityProcess entrypoint
│   │   │   ├── permission-gate.ts             ★
│   │   │   ├── permission-gate.test.ts        ★
│   │   │   ├── rpc-bridge.ts                  ★
│   │   │   ├── rpc-bridge.test.ts             ★
│   │   │   └── host-api/                      ★
│   │   │       ├── session-api.ts             ★
│   │   │       ├── workspace-api.ts           ★
│   │   │       ├── notifications-api.ts       ★
│   │   │       └── filesystem-api.ts          ★
│   ├── preload/
│   │   └── index.ts                           △  # Expose session/profile/plugin/platform APIs via contextBridge
│   ├── renderer/
│   │   ├── index.tsx                          △  # Initialize session/profile/plugin stores
│   │   ├── components/
│   │   │   ├── App.tsx                        △  # Layout now includes plugin host slots and profile launch surfaces
│   │   │   ├── Terminal/
│   │   │   │   ├── TerminalView.tsx           △  # Session-aware terminal rendering and status handling
│   │   │   │   └── TerminalSessionBadge.tsx   ★
│   │   │   ├── Profiles/                      ★
│   │   │   │   ├── ProfilesPanel.tsx          ★
│   │   │   │   ├── ProfilesPanel.module.css   ★
│   │   │   │   ├── ConnectionWizard.tsx       ★
│   │   │   │   ├── SecretPromptDialog.tsx     ★
│   │   │   │   └── HostTrustDialog.tsx        ★
│   │   │   ├── Plugins/                       ★
│   │   │   │   ├── PluginPanelHost.tsx        ★
│   │   │   │   ├── PluginPanelHost.module.css ★
│   │   │   │   ├── PluginCommandPalette.tsx   ★
│   │   │   │   └── PluginPermissionDialog.tsx ★
│   │   │   ├── Settings/                      △  # Add profile, restore, plugin, and platform sections
│   │   │   └── TabBar/                        △  # Tab items reference session status and profile icons
│   │   └── state/
│   │       ├── session-store.ts               ★
│   │       ├── session-store.test.ts          ★
│   │       ├── profile-store.ts               ★
│   │       ├── profile-store.test.ts          ★
│   │       ├── plugin-store.ts                ★
│   │       ├── plugin-store.test.ts           ★
│   │       ├── tab-store.ts                   △  # Layout references sessionId only
│   │       └── theme-store.ts                 (unchanged)
│   └── shared/
│       ├── channels.ts                        △  # Add session/profile/plugin/platform channels
│       ├── ipc-types.ts                       △  # Add session/profile/plugin payloads
│       ├── session-types.ts                   ★
│       ├── transport-types.ts                 ★
│       ├── profile-schema.ts                  ★
│       ├── profile-types.ts                   ★
│       ├── plugin-manifest-schema.ts          ★
│       ├── plugin-capabilities.ts             ★
│       ├── plugin-rpc.ts                      ★
│       ├── error-codes.ts                     ★
│       └── platform-types.ts                  ★
├── e2e/
│   ├── session-create-and-restore.test.ts     ★
│   ├── ssh-profile-connect.test.ts            ★
│   ├── serial-profile-connect.test.ts         ★
│   ├── plugin-enable-disable.test.ts          ★
│   ├── profile-import-export.test.ts          ★
│   └── cross-platform-smoke.test.ts           ★
├── forge.config.ts                            △  # Add utility-process entry build and platform packaging updates
├── vite.main.config.ts                        △
├── vite.renderer.config.ts                    △
├── package.json                               △  # Add ssh2, serialport, telnet-client; relax platform gating when ready
└── README.md                                  △  # Update profile, plugin, and cross-platform distribution guidance
```

### Architectural Boundaries

**Session boundary:**

- `SessionManager` owns lifecycle, state transitions, reconnect, and restore.
- Transport adapters own protocol specifics.
- `TabManager` owns only layout and ordering.
- Renderer terminal components render output but never own connection objects.

**Plugin boundary:**

- Core app code never imports plugin backend modules directly.
- Backend plugins execute through the utility-process host and typed RPC bridge.
- Renderer plugin panels render through `PluginPanelHost` and consume only manifest-approved APIs.

**Platform boundary:**

- Only `src/main/platform/**` branches on the operating system.
- Session/profile/plugin modules ask the platform service for capabilities instead of checking `process.platform` directly.

**Secret boundary:**

- Only `SecretVault` reads or writes encrypted secret material.
- Renderer state holds prompt state and validation state, never persisted secrets.
- Profile export/import code receives secret references, not decrypted values.

### Integration Points

**Session creation flow:**

```text
Renderer profile picker
  -> profile-store.ts
  -> preload session:createFromProfile(profileId)
  -> ipc-handlers.ts
  -> SessionManager.createFromProfile(profileId)
  -> SecretVault / HostTrustStore lookup
  -> transport.open(session)
  -> session:data / session:status-changed events
  -> session-store.ts
  -> TerminalView.tsx
```

**Plugin panel flow:**

```text
User opens plugin panel
  -> plugin-store.ts command dispatch
  -> preload plugin:command(pluginId, commandId)
  -> PluginManager permission check
  -> utilityProcess backend or renderer contribution activation
  -> PluginPanelHost renders contribution by manifest ID
```

**Restore flow:**

```text
App startup
  -> app-lifecycle.ts
  -> SessionPersistence.loadSnapshot()
  -> TabManager.restoreLayout(snapshot.layout)
  -> SessionManager.reopenSessions(snapshot.sessions)
  -> renderer stores hydrate from session/profile/plugin events
```

---

## Architecture Validation Results

### Coherence Validation

**Decision compatibility:**

| Decision Pair | Compatible? | Notes |
|---|---|---|
| SessionManager (P3-1) + transport contract (P3-2) | Yes | Session lifecycle and protocol behavior are separated cleanly |
| Profiles/secrets (P3-3) + cross-platform service layer (P3-5) | Yes | Secret persistence and default profile templates remain portable while platform-specific behavior stays isolated |
| Plugin runtime (P3-4) + Phase 1 security posture | Yes | Utility-process isolation and typed permission gates extend the original hardening model instead of bypassing it |
| Session restore (P3-6) + drop-down UX invariants | Yes | Restore happens at startup and never changes hide/show semantics during normal use |
| Built-in plugins (P3-7) + plugin runtime (P3-4) | Yes | Dogfooding the API strengthens, rather than competes with, the extension model |
| Distribution model (P3-8) + repo memory Windows wrapper | Yes | Windows keeps its current release path while new platforms get additive artifacts |

**Pattern consistency:**

- Session, profile, plugin, and platform APIs all follow the established `domain:action` IPC naming pattern.
- The repository keeps its current split between main, preload, renderer, and shared code while adding new feature folders instead of flattening the architecture.
- New cross-platform behavior stays behind one platform boundary, which matches the existing preference for centralized system integration modules.

**Structure alignment:**

- The project tree maps every Phase 3 feature to a concrete source location.
- Plugin, profile, and transport code each have clear ownership boundaries.
- Session restore, remote protocols, and plugins all build on the existing tab/theme/settings renderer architecture instead of replacing it.

### Requirements Coverage Validation

| Phase 3 Requirement | Architecture Coverage |
|---|---|
| SSH, telnet, and serial sessions | `SessionManager` + transport adapters + profile/store flows |
| Plugin architecture | Manifest schema, plugin manager, utility-process host, renderer plugin panel host |
| Cross-platform support | `PlatformService`, cross-platform shell discovery, release packaging strategy |
| Profile system with sharing | `ProfileStore`, `SecretVault`, `HostTrustStore`, export/import schema |
| Git visual integration plugin | First-party plugin under `plugins/builtin/git-visual/` |
| SFTP browser and log viewer plugins | First-party plugins under `plugins/builtin/` using session/plugin host APIs |
| Session management across restart | Session persistence and reconnect design in P3-6 |

### Non-Functional Coverage Validation

| Concern | Covered? | How |
|---|---|---|
| Security boundary preservation | Yes | Plugins are isolated, secrets are encrypted, IPC remains typed |
| Cross-platform maintainability | Yes | Platform behavior is centralized instead of scattered |
| Extensibility | Yes | First-party and third-party plugins use the same manifest and permission system |
| Reliability | Yes | Session restore/reconnect and typed error codes formalize recovery paths |
| Distribution continuity | Yes | Windows path stays stable while new platforms are additive |

### Gap Analysis

**No critical gaps identified.**

**Important implementation notes:**

1. **Local shell restore is reopen, not resume.** The architecture intentionally avoids pretending a terminated PTY can be resumed after app exit.
2. **Telnet is intentionally second-class from a trust standpoint.** It is supported for scope completeness, but hidden behind explicit user opt-in and warning flows.
3. **Public plugin marketplace trust is deferred.** Phase 3 supports local and bundled plugins safely; a hosted marketplace requires additional signing and revocation work.
4. **macOS notarization and broader Linux packaging polish remain release-engineering tasks.** They do not block the runtime architecture but must land before broad public cross-platform rollout.

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key strengths:**

- The architecture fixes the core Phase 2 limitation by separating transport state from tab layout.
- Secure profile sharing is treated as a first-class design problem, not a late patch.
- Plugin isolation is concrete enough to support real built-in features without weakening the Electron hardening posture.
- Cross-platform support is additive to the current Windows release model instead of requiring a rewrite.

**First implementation priority:**

1. Create `SessionManager` and migrate terminal IPC/events to session-oriented payloads.
2. Add `ProfileStore` and `SecretVault` so remote session work has safe persistence primitives.
3. Introduce `PlatformService` before landing macOS/Linux-specific feature work.

---

## Implementation Handoff

**AI Agent Guidelines:**

- Follow the session/profile/plugin/platform boundaries exactly as defined above.
- Do not add protocol-specific behavior directly into renderer terminal components.
- Keep Windows compatibility intact while Phase 3 cross-platform work lands incrementally.
- Treat built-in plugins as test cases for the extension model, not as exceptions to it.

**Next practical step:** Begin with a story that introduces `SessionManager`, the shared `session:*` payload types, and the `session-store.ts` renderer mirror without changing visible behavior for local shell tabs.