---
title: "Product Brief Distillate: QuakeShell"
type: llm-distillate
source: "product-brief-QuakeShell.md"
created: "2026-03-31"
purpose: "Token-efficient context for downstream PRD creation"
---

# Product Brief Distillate: QuakeShell

## Inspiration & Heritage

- Direct inspiration: Guake (GNOME) and Yakuak (KDE) — Quake-style drop-down terminals on Linux
- Long-term vision benchmark: MobaXterm — all-in-one terminal (SSH, telnet, X11, SFTP) but proprietary and session-limited
- User (Barna) has personal experience with Linux drop-down terminals and wants to bring that workflow to Windows
- "All in one tool such as MobaXterm, with very convenient usage, always accessible" — direct quote capturing the vision

## Requirements Hints (from user input)

- PowerShell (latest) as default shell — non-negotiable for v1
- WSL shell support in v1 — configurable default shell selection
- Global hotkey: drops terminal down from top of screen
- Focus-fade: terminal fades/hides when losing focus — must be configurable (some users will hate it)
- Opacity: adjustable transparency while terminal is visible
- npm installable — but also Scoop and Winget for broader reach
- Silent Windows autostart — no visible terminal window, no tray balloon on boot
- Hotkey remapping UI in v1 — critical due to conflict risk with gaming overlays, VPNs, screen readers
- First-run onboarding experience — show hotkey, let user try it, configure basics

## Technical Context (from research)

- **Stack confirmed:** Electron 41+ / TypeScript / node-pty 1.1+ / xterm.js 6+ / electron-store / Vite / Electron Forge
- **All Electron APIs verified:** globalShortcut, BrowserWindow (frameless, opacity, alwaysOnTop), Tray, app.setLoginItemSettings()
- **Windows ConPTY** (Win10 1809+) is the binding OS constraint — enables VT-aware + legacy Win32 console apps via node-pty
- **Architecture pattern:** Tray-resident single-window; pre-created hidden BrowserWindow toggled show/hide for sub-100ms response
- **4-module decomposition:** AppLifecycle, WindowManager, TerminalManager, ConfigStore
- **Security model:** Context isolation, sandbox, strict CSP, minimal IPC (6 channels), @electron/fuses in production
- **IPC pattern:** Invoke/handle for request-response (config, terminal ops); send/on for events (hotkey, focus changes)
- **Config persistence:** electron-store with JSON schema validation; 12-setting schema identified
- **Native module handling:** @electron/rebuild for node-pty compilation; Electron Forge handles this automatically
- **Packaging:** Electron Forge → Squirrel.Windows installer; update-electron-app for auto-updates via GitHub Releases
- **npm distribution pattern:** Puppeteer-style postinstall binary download (not bundling Electron in the npm tarball)
- **Realistic footprint:** ~120-150 MB installed (Electron baseline); ~80 MB idle RAM when hidden
- **Minimum OS:** Windows 10 version 1809+ (ConPTY support)
- **Full research document:** docs/planning-artifacts/research/technical-quake-terminal-windows-research-2026-03-31.md

## Competitive Intelligence

- **Windows Terminal:** Powerful but no drop-down mode; aggressive feature roadmap; ~30 MB
- **ConEmu/Cmder:** Has Quake mode but GDI rendering, dated UI, stagnating development
- **Tabby:** Has Quake mode + WebGL rendering but ~120 MB, complex config, broad scope dilutes UX
- **MobaXterm:** All-in-one benchmark (SSH/telnet/X11/SFTP) but proprietary, free tier limited
- **Hyper:** Electron-based, ~90 MB, no drop-down mode, plugin ecosystem exists but app is sluggish
- **Alacritty/Wezterm:** GPU-accelerated, minimal — emerging but no native drop-down; potential future competitors via plugins

## Scope Signals

**In for v1:**
- Core drop-down UX (hotkey, slide animation, focus-fade, opacity)
- PowerShell + WSL as shell options
- System tray, silent autostart, persistent terminal state
- Hotkey remapping, first-run onboarding, settings config
- Distribution: npm + Scoop + Winget

**Out for v1, in for future:**
- Multi-tab / split-pane (v1.x)
- SSH / telnet / serial connections with session management (v2)
- Theming engine with community themes (v1.x)
- Plugin architecture (v2) — target extensions: SFTP browser, log viewer, API tester, git visual integration
- Multi-shell switching per tab — cmd, Git Bash (WSL already in v1)
- macOS / Linux support (v2+)

**Explicitly deferred decisions:**
- Git integration: CLI from PowerShell is sufficient for v1; visual git (diffs, repo status panels) is a future plugin candidate
- Telemetry: opt-in telemetry mentioned for retention metrics but no design decision made
- License: MIT confirmed by user intent but no LICENSE file created yet
- GitHub repo: user confirmed will create later, not yet set up

## Rejected Ideas & Rationale

- **Tauri as framework:** Evaluated in research; lacks mature terminal embedding (no node-pty equivalent in Rust ecosystem); disqualified
- **Native Win32/.NET:** Cannot be npm-installed; disqualified by distribution requirement
- **npm as primary/only distribution:** Reviewed — creates friction (requires Node.js installed); reframed as one channel alongside Scoop/Winget
- **"npm-installable" as competitive moat:** Skeptic review determined this is a liability not a strength for desktop apps; repositioned as convenience, not differentiator

## Open Questions for PRD

- Animation parameters: slide duration, easing curve — user-configurable or opinionated defaults?
- Multi-monitor support: which monitor does the terminal drop down on? Follow cursor? Primary only? Configurable?
- Terminal dimensions: full-width or configurable width? Height as percentage of screen?
- Settings UI vs config file: build a GUI settings panel, or JSON config with hot-reload? Both?
- Tray icon behavior: left-click toggle? Right-click menu? What menu items?
- Shell profile management: how does user switch between PowerShell and WSL? Dropdown? Config only?
- Update UX: auto-update silently, or prompt user? What if update requires restart?
- Keyboard shortcut default: what key combo ships as default? (F12? Ctrl+` ? Tilde?)
- Focus-fade vs focus-hide: fade to transparent, or fully hide? Or both as options?
- Scrollback buffer size: configurable? Default limit?

## Success Metrics (refined)

- 1,000+ combined installs (npm + Scoop + Winget) within 3 months
- 40%+ 2-week retention (opt-in telemetry or proxy via GitHub activity)
- Sub-100ms toggle latency, 60fps animation, <80 MB idle RAM
- <1% crash rate per session
- Community contribution within 6 months (theme or config)
