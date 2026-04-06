---
stepsCompleted: [step-01-init, step-02-discovery, step-02b-vision, step-02c-executive-summary, step-03-success, step-04-journeys, step-05-domain-skipped, step-06-innovation-skipped, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, step-12-complete]
inputDocuments:
  - docs/planning-artifacts/product-brief-QuakeShell.md
  - docs/planning-artifacts/product-brief-QuakeShell-distillate.md
  - docs/planning-artifacts/research/technical-quake-terminal-windows-research-2026-03-31.md
workflowType: 'prd'
classification:
  projectType: desktop_app
  domain: general
  complexity: low
  projectContext: greenfield
---

# Product Requirements Document - QuakeShell

**Author:** Barna
**Date:** 2026-03-31

## Executive Summary

QuakeShell is a Quake-style drop-down terminal for Windows — a tray-resident application that slides down from the top of the screen on a global hotkey, providing instant PowerShell (and WSL) access without window management overhead. Built on Electron, node-pty, and xterm.js, it targets developers and power users who want an always-available terminal that stays out of the way until needed.

The product is built to solve a personal need: fast, convenient, everyday terminal access on Windows without alt-tabbing through windows or managing terminal placement. It runs silently on startup, responds in under 100ms, and preserves terminal state across show/hide cycles. Distributed initially via npm, with Scoop and Winget planned for Phase 2.

v1 scope is intentionally focused: drop-down toggle, PowerShell + WSL shells, configurable opacity and focus-fade, system tray integration, silent autostart, and hotkey remapping. Future versions expand toward multi-tab, SSH/telnet, theming, and a plugin architecture — growing from a personal productivity tool into an open-source alternative to MobaXterm.

## What Makes This Special

QuakeShell is built around the Quake-style workflow as the entire UX, not as a secondary feature bolted onto a general-purpose terminal. Every design decision — pre-created hidden window, tray-resident lifecycle, focus-fade, global hotkey — serves one goal: the fastest way to get a terminal on screen, do your thing, and get back to work.

The core insight: Windows has no modern, open-source drop-down terminal. ConEmu is dated, Tabby is overbuilt, Windows Terminal has no drop-down mode at all. QuakeShell fills that gap with a focused, opinionated tool built by a developer who actually needs it.

## Project Classification

- **Project Type:** Desktop application (Electron-based, Windows)
- **Domain:** Developer tools / productivity
- **Complexity:** Low — well-understood technology stack, proven architecture patterns, no regulatory requirements
- **Project Context:** Greenfield — new product, no existing codebase

## Success Criteria

### User Success

- **Instant access:** User presses hotkey → terminal is visible and ready in <100ms. No perceptible delay.
- **Zero workflow disruption:** Terminal appears over current work, user runs commands, terminal disappears — no alt-tabbing, no window hunting, no context switching.
- **State persistence:** Running processes, scrollback, and working directory survive show/hide cycles. The terminal is always where you left it.
- **"It just works" onboarding:** First-run experience teaches the hotkey and lets user configure basics. Under 30 seconds from install to first terminal toggle.

### Business Success

- **Adoption:** 1,000+ combined installs (npm + Scoop + Winget) within 3 months of release
- **Retention:** 40%+ of installers still active after 2 weeks (measured via opt-in telemetry or issue/discussion activity)
- **Community traction:** 100+ GitHub stars within 6 months; first community-contributed config or theme shared
- **Personal success:** Barna uses it daily as primary terminal workflow — the ultimate dogfooding metric

### Technical Success

- **Toggle latency:** <100ms hotkey-to-visible, 60fps slide animation
- **Resource efficiency:** <80 MB idle RAM when hidden; no perceptible battery impact on laptops
- **Stability:** <1% crash rate per session; stable across Windows 10 (1809+) and Windows 11
- **Clean packaging:** Working installs via all three channels (npm, Scoop, Winget) with functional auto-update

### Measurable Outcomes

| Metric | Target | Timeframe |
|---|---|---|
| Toggle latency | <100ms | v1 launch |
| Idle RAM | <80 MB | v1 launch |
| Crash rate | <1% per session | v1 launch |
| Installs | 1,000+ | 3 months |
| GitHub stars | 100+ | 6 months |
| 2-week retention | 40%+ | Ongoing |

## User Journeys

### Journey 1: Barna — The Daily Driver (Primary User, Happy Path)

Barna is a developer working on multiple projects across VS Code, browser, and documentation. He needs to run PowerShell commands constantly — git status, npm scripts, docker commands, quick file operations — but hates breaking flow to find or open a terminal window.

**Opening:** Barna is deep in VS Code editing TypeScript. He needs to check `git log` for the last commit message. His taskbar has 12 windows open.

**Rising Action:** He presses `Ctrl+~`. QuakeShell slides down from the top of the screen in ~200ms, semi-transparent, covering the top 40% of his display. His previous session is still there — he's in the right directory, scrollback intact. He types `git log --oneline -5`, scans the output.

**Climax:** He presses `Ctrl+~` again. The terminal slides away. Total interruption: 3 seconds. He never left his editor, never alt-tabbed, never moved his mouse. The command was run and he's back to coding.

**Resolution:** This happens 30-50 times a day. QuakeShell becomes invisible infrastructure — Barna stops thinking about terminal access entirely. It's just *there*.

**Reveals:** Core toggle UX, state persistence, hotkey reliability, animation smoothness, opacity/transparency.

### Journey 2: New User — First Install (Onboarding Path)

Alex is a backend developer who saw QuakeShell on Hacker News. She uses Windows Terminal daily but has always missed Guake from her Ubuntu days.

**Opening:** Alex runs `scoop install quakeshell`. Installation completes. QuakeShell starts and shows a first-run overlay.

**Rising Action:** The overlay says: *"Press Ctrl+~ to toggle your terminal. Try it now!"* She presses the hotkey. The terminal drops down. She types `ls` — it works, PowerShell is running. She presses the hotkey again — it slides away. She grins.

**Climax:** The overlay shows a quick settings panel: default shell (PowerShell/WSL), hotkey, opacity slider, focus-fade toggle. She switches default shell to WSL, adjusts opacity to 85%, enables focus-fade. Done in 15 seconds.

**Resolution:** She closes the overlay. QuakeShell is running in the system tray. Next time she boots Windows, it's already there. She never configures it again.

**Reveals:** Installation UX across package managers, first-run onboarding, settings UI, shell selection, autostart behavior.

### Journey 3: Power User — Hotkey Conflict (Edge Case / Error Recovery)

Marcus is a gamer and developer. He installs QuakeShell but his streaming overlay (OBS) already uses `Ctrl+~`.

**Opening:** Marcus presses `Ctrl+~` — nothing happens. OBS captures the keypress instead.

**Rising Action:** He right-clicks the QuakeShell tray icon → "Settings". He sees the hotkey field shows a conflict warning: *"Ctrl+~ may be intercepted by another application."* He clicks the field and presses `F12`. The field updates.

**Climax:** He presses `F12` — QuakeShell drops down instantly. The conflict is resolved.

**Resolution:** His custom hotkey persists across restarts. He never encounters the issue again.

**Reveals:** Hotkey conflict detection/handling, tray icon right-click menu, settings UI for remapping, conflict warnings, configuration persistence.

### Journey 4: WSL Developer — Shell Switching

Priya runs Ubuntu in WSL for her Python/Docker work but needs PowerShell for Azure CLI and Windows-specific tasks.

**Opening:** Priya has QuakeShell configured with WSL as her default shell. She drops it down and is in her Ubuntu home directory. She runs `docker compose up`.

**Rising Action:** She needs to run an Azure PowerShell command. She opens QuakeShell settings and switches default shell to PowerShell. *(Future: in multi-tab version, she'd just open a new tab — but in v1, she switches the default.)*

**Climax:** She restarts the terminal session. PowerShell loads. She runs her Azure command. Switches back to WSL when done.

**Resolution:** The shell switching works but is clunky in v1 — she looks forward to multi-tab support.

**Reveals:** WSL integration, shell switching UX (v1 limitation), config persistence, session restart behavior, multi-tab as growth priority.

### Journey Requirements Summary

| Journey | Key Capabilities Revealed |
|---|---|
| Daily Driver | Toggle UX, state persistence, hotkey reliability, animation, opacity |
| First Install | Package manager install, onboarding flow, settings UI, shell selection, autostart |
| Hotkey Conflict | Conflict detection, tray menu, hotkey remapping, config persistence |
| WSL Switching | WSL support, shell config, session management, growth feature validation |

## Desktop Application Requirements

### Platform Support

- **v1:** Windows 10 (version 1809+) and Windows 11 only
- **Minimum OS constraint:** Windows ConPTY API requires Windows 10 1809+
- **Architecture:** x64 primary; ARM64 Windows as stretch goal
- **Cross-platform:** Not in scope for v1; macOS/Linux deferred to future versions

### System Integration

- **System tray:** Tray-resident with icon; left-click toggles terminal, right-click opens context menu (Settings, Check for Updates, Quit)
- **Global hotkey:** System-wide keyboard shortcut registered via Electron `globalShortcut`; configurable with conflict detection
- **Windows autostart:** Silent startup via `app.setLoginItemSettings()` — no splash screen, no tray balloon, no visible window
- **ConPTY:** Windows Pseudo Console for full terminal I/O (PowerShell + WSL + legacy console apps)
- **Windows notifications:** Native Windows toast notifications for terminal events — e.g., background process needs user input, long-running command completed. Useful for CLI tools like Claude CLI that request attention while QuakeShell is hidden
- **Single instance:** Only one QuakeShell process at a time; second launch focuses existing instance

### Update Strategy

- **Distribution:** npm is the primary deployment target (GitHub Actions → npm publish)
- **Update check:** Periodic check for new npm package version
- **Update UX:** Prompt user via tray notification — "QuakeShell vX.Y.Z available. Update now?" User chooses when to update
- **No silent background updates** — user controls when updates happen
- **No GitHub Releases dependency** for now (no repo yet); npm is the source of truth

### Offline Capabilities

- **Fully offline by default** — QuakeShell is a local terminal emulator with no cloud dependencies
- **Network usage:** Only for update checks (periodic, non-blocking)
- **No telemetry network calls** unless user explicitly opts in (future)
- **Graceful offline:** Update checks fail silently; no error dialogs, no degraded functionality

### Implementation Considerations

- **Electron Forge** with Vite plugin for build toolchain
- **node-pty** native module requires `@electron/rebuild` at build time
- **Squirrel.Windows** for installer packaging (even without GitHub Releases, Squirrel handles install/uninstall/shortcuts)
- **electron-store** for JSON config persistence with schema validation
- **Security:** Context isolation, sandbox, strict CSP, @electron/fuses — full Electron security checklist

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP — deliver the core "instant terminal access" experience with enough polish to be a daily driver. If Barna uses it every day and it doesn't crash, v1 is a success.

**Resource Requirements:** Solo developer (Barna). Electron + TypeScript ecosystem means one person can reasonably build, test, and ship the MVP.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Daily Driver (Journey 1) — full support
- First Install (Journey 2) — full support
- Hotkey Conflict (Journey 3) — full support
- WSL Switching (Journey 4) — basic support (config-based, not tab-based)

**Must-Have Capabilities:**

| Capability | Justification |
|---|---|
| Global hotkey toggle (configurable + remapping) | Core UX — without this, the product doesn't exist |
| Slide-down animation | Core UX — defines the Quake-style experience |
| PowerShell shell | Default shell — primary use case |
| WSL shell support | Confirmed v1 feature; configurable default |
| Opacity + focus-fade (configurable) | Core differentiator vs alternatives |
| System tray (no taskbar) | Tray-resident is the architectural identity |
| Silent Windows autostart | "Always there" promise |
| State persistence across show/hide | Critical for daily driver usage |
| Settings config (electron-store) | Required for all configurable features |
| First-run onboarding | 30-second install-to-toggle goal |
| Single instance enforcement | Prevents duplicate processes |
| Windows notifications | Terminal attention events (e.g., CLI needs input) |
| npm distribution | Primary deployment channel |
| Update prompt via tray | User-controlled updates |

### Post-MVP Features

**Phase 2 (Growth — v1.x):**
- Multi-tab and split-pane terminal sessions
- Theming engine with community themes
- Multi-shell switching per tab (cmd, Git Bash)
- Custom color schemes and font configuration
- Terminal dimensions/position configuration (width, height, monitor selection)
- Scoop and Winget distribution packages
- Shell context menu integration ("Open QuakeShell here")

**Phase 3 (Expansion — v2+):**
- SSH, telnet, and serial connections with session management
- Plugin architecture for custom extensions
- Cross-platform (macOS, Linux)
- Profile system with shareable configurations
- Git visual integration plugin
- SFTP browser, log viewer plugins

### Risk Mitigation Strategy

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Global hotkey conflicts with other apps | High | High | Remapping UI in v1; conflict detection warnings; non-standard default key |
| node-pty native module build failures on user machines | Medium | High | Ship pre-built binaries; Electron Forge handles rebuild; test on clean Windows installs |
| Electron memory footprint exceeds expectations | Medium | Medium | Benchmark early; lazy-load renderer; monitor idle RAM in CI |
| npm distribution confuses non-Node users | Medium | Medium | Clear install docs; Scoop/Winget in Phase 2 |
| Animation jank on low-end hardware | Low | Medium | Use `setBounds()` not CSS animation; test on integrated GPUs; provide "instant" mode fallback |
| ConPTY edge cases with legacy console apps | Low | Low | Target modern shells (PowerShell 7, WSL); document known limitations |

## Functional Requirements

### Terminal Core

- FR1: User can spawn a terminal session running PowerShell (latest) as the default shell
- FR2: User can spawn a terminal session running a WSL distribution shell
- FR3: User can type commands and see output rendered with GPU-accelerated terminal rendering (xterm.js WebGL)
- FR4: User can scroll through terminal scrollback buffer
- FR5: User can copy text from the terminal to the system clipboard
- FR6: User can paste text from the system clipboard into the terminal
- FR7: System preserves terminal state (scrollback, running processes, working directory) across show/hide cycles

### Window Management

- FR8: User can toggle the terminal window visible/hidden via a global keyboard shortcut
- FR9: System slides the terminal window down from the top of the screen with animation when shown
- FR10: System slides the terminal window up and hides it with animation when dismissed
- FR11: User can adjust the terminal window opacity while it is visible
- FR12: System hides the terminal window when it loses focus (focus-fade), if enabled by user
- FR13: System displays the terminal as a frameless, borderless, always-on-top window with no taskbar presence

### Configuration

- FR14: User can configure which keyboard shortcut toggles the terminal
- FR15: User can configure the default shell (PowerShell or WSL)
- FR16: User can configure terminal opacity level
- FR17: User can enable or disable focus-fade behavior
- FR18: User can configure animation speed
- FR19: System persists all configuration to disk and loads it on startup
- FR20: System validates configuration against a defined schema on load

### System Tray

- FR21: System displays an icon in the Windows system tray while running
- FR22: User can toggle the terminal by left-clicking the tray icon
- FR23: User can access a context menu by right-clicking the tray icon
- FR24: Tray context menu provides access to: Settings, Check for Updates, Quit

### Hotkey Management

- FR25: User can remap the global hotkey through a settings interface
- FR26: System detects and warns when the configured hotkey may conflict with another application
- FR27: System gracefully handles hotkey registration failure (shows notification, falls back to tray toggle)

### Notifications

- FR28: System can send Windows toast notifications for terminal events (e.g., background process requests user input, long-running command completes)
- FR29: User can interact with a notification to bring the terminal into view

### Application Lifecycle

- FR30: System starts silently on Windows login with no visible window or tray balloon
- FR31: User can enable or disable Windows autostart from settings
- FR32: System enforces single instance — launching a second instance focuses the existing one
- FR33: System checks for available updates periodically and prompts the user via tray notification
- FR34: User can trigger an update check manually from the tray context menu

### Onboarding

- FR35: System displays a first-run experience on initial launch that teaches the hotkey and offers basic configuration
- FR36: User can set default shell, hotkey, opacity, and focus-fade during first-run onboarding
- FR37: User can dismiss the first-run experience and access settings later

## Non-Functional Requirements

### Performance

- NFR1: Hotkey-to-visible toggle completes in <100ms (measured from keypress to first painted frame)
- NFR2: Slide animation runs at 60fps with no dropped frames on integrated GPUs (Intel UHD 620+)
- NFR3: Terminal input-to-render latency is <16ms (one frame at 60fps) for typed characters
- NFR4: Idle memory usage (terminal hidden) is <80 MB RAM
- NFR5: Active memory usage (terminal visible, shell running) is <150 MB RAM
- NFR6: Application cold start (boot to tray-ready) completes in <3 seconds
- NFR7: Application does not cause perceptible battery drain when idle on laptops

### Security

- NFR8: Main process and renderer process are isolated via Electron context isolation (contextBridge)
- NFR9: Renderer process runs in sandboxed mode
- NFR10: Content Security Policy blocks all inline scripts and remote resource loading
- NFR11: IPC surface is limited to explicitly defined channels only (no wildcard listeners)
- NFR12: No user data is transmitted over the network (fully local operation)
- NFR13: Production builds apply @electron/fuses to disable debugging and remote code loading
- NFR14: Configuration files are stored with user-only file permissions

### Reliability

- NFR15: Application crash rate is <1% per user session
- NFR16: Terminal state (scrollback, processes) survives application show/hide cycles with zero data loss
- NFR17: Application recovers gracefully from shell process crashes (restarts shell, notifies user)
- NFR18: Single instance lock prevents data corruption from duplicate processes
- NFR19: Configuration file corruption is detected and falls back to defaults with user notification

### Usability

- NFR20: First-time user can complete install → first toggle in <30 seconds
- NFR21: All core functionality is accessible via keyboard (no mouse required)
- NFR22: Settings changes take effect immediately without application restart (except shell change)
- NFR23: Tray icon and notifications follow Windows system theme (light/dark)
