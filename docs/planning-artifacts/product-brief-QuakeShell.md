---
title: "Product Brief: QuakeShell"
status: "complete"
created: "2026-03-31"
updated: "2026-03-31"
inputs:
  - docs/planning-artifacts/research/technical-quake-terminal-windows-research-2026-03-31.md
---

# Product Brief: QuakeShell

## Executive Summary

QuakeShell is an open-source, Quake-style drop-down terminal for Windows — always running, instantly accessible with a single keyboard shortcut, and gone when you don't need it. It brings the beloved Guake/Yakuak experience from Linux to Windows with a modern stack, while laying the foundation for an all-in-one terminal power tool comparable to MobaXterm.

Today, Windows power users and developers juggle multiple terminal windows, alt-tab through cluttered taskbars, or settle for terminal emulators that feel either dated (ConEmu/Cmder) or overbuilt (Tabby). QuakeShell takes a different approach: a single, lightweight terminal that lives at the top of your screen, appears in milliseconds when you need it, and vanishes when you don't. No window management. No taskbar clutter. Just your shell, always one hotkey away.

Built on Electron, node-pty, and xterm.js — the same stack that powers VS Code's integrated terminal — QuakeShell is distributed via npm, Scoop, and Winget, starts silently with Windows, and delivers GPU-accelerated terminal rendering out of the box. Future versions will expand into SSH, telnet, multi-tab workflows, theming, and a plugin ecosystem — evolving from a focused drop-down terminal into a full-featured, open-source alternative to MobaXterm.

## The Problem

Developers and power users on Windows need constant, friction-free access to a terminal. The reality today:

- **Windows Terminal** is powerful but conventional — it's a window you open, arrange, minimize, and hunt for among fifteen other windows. There's no native drop-down mode.
- **ConEmu/Cmder** offer Quake-style drop-down but feel dated, rely on legacy rendering, and haven't kept pace with modern terminal standards.
- **Tabby** provides Quake mode but ships at ~120 MB with complex configuration, and its broad scope dilutes the core drop-down experience.
- **MobaXterm** is the all-in-one benchmark (SSH, telnet, X11, SFTP) but is proprietary, Windows-native only, and the free version is limited to 12 sessions.

The core frustration: **there is no modern, open-source, lightweight drop-down terminal for Windows** that just works — one hotkey, instant shell, disappears when you're done. Every option requires compromise: outdated UI, heavy footprint, closed source, or no drop-down mode at all.

## The Solution

QuakeShell is a tray-resident terminal that slides down from the top of your screen when you press a global hotkey. It runs PowerShell (latest) or WSL by default, renders with GPU acceleration, and fades out when it loses focus. Install it via npm, Scoop, or Winget, and it auto-starts silently with Windows — no terminal window, no tray balloon, just there when you need it.

**The core experience:**
- Press a hotkey → terminal slides down from the top of the screen
- Use your shell → full PowerShell experience with modern rendering
- Click away or press the hotkey again → terminal fades and hides
- Adjust opacity, animation speed, and focus behavior to taste

The window is pre-created and hidden, not spawned on demand — toggle latency is sub-100ms. Terminal state (scrollback, running processes) persists between show/hide cycles.

## What Makes This Different

| | QuakeShell | Windows Terminal | ConEmu/Cmdr | Tabby | MobaXterm |
|---|---|---|---|---|---|
| Drop-down mode | Core UX | No | Yes (dated) | Yes (heavy) | No |
| Modern rendering | WebGL (xterm.js) | DirectX | GDI/legacy | WebGL | Native |
| Open source | Yes (MIT) | Yes | Yes | Yes | No |
| WSL support | v1 | Yes | Partial | Yes | No |
| Focus-fade | Configurable | No | Basic | Basic | No |
| Footprint | ~120-150 MB | ~30 MB | ~15 MB | ~120 MB | ~25 MB |

QuakeShell's moat is **focus and experience**: the only modern drop-down terminal for Windows built from the ground up around the Quake-style workflow. Distributed via npm, Scoop, and Winget to meet developers where they are. The competitive landscape is either missing drop-down entirely (Windows Terminal, MobaXterm) or delivers it as a secondary feature in a bloated package (Tabby) or aging codebase (ConEmu).

## Who This Serves

**Primary: Windows developers and power users** who live in the terminal — backend engineers, DevOps practitioners, sysadmins, and CLI-native developers who want always-available shell access without workflow disruption. They've used Guake or Yakuak on Linux and miss it on Windows, or they've tried ConEmu's Quake mode and want something modern.

**Secondary (future): Remote access power users** who need SSH, telnet, and multi-protocol access — the MobaXterm audience who would prefer an open-source, extensible alternative.

## Success Criteria

- **Adoption:** 1,000+ combined installs (npm + Scoop + Winget) within 3 months; 100+ GitHub stars within 6 months
- **Retention:** 40%+ of installers still using QuakeShell after 2 weeks (measured via opt-in telemetry or GitHub issue activity)
- **Performance:** Sub-100ms hotkey-to-visible toggle; smooth 60fps slide animation; <80 MB idle RAM when hidden
- **Reliability:** <1% crash rate per session; stable across Windows 10/11; zero terminal state loss across show/hide cycles
- **Community signal:** First community-contributed theme or configuration shared within 6 months

## Scope

**v1 (MVP):**
- Global hotkey toggle (configurable, with remapping UI)
- Slide-down animation from top of screen
- PowerShell (latest) as default shell
- WSL shell support (configurable default shell)
- Configurable opacity and focus-fade behavior
- System tray integration (no taskbar presence)
- Silent Windows autostart
- Distribution via npm, Scoop, and Winget
- Persistent terminal state across show/hide
- Settings UI or config file for core preferences
- First-run onboarding (hotkey demo, basic configuration)

**Explicitly NOT in v1:**
- Multi-tab / split-pane
- SSH / telnet / multi-protocol
- Theming / custom color schemes beyond basics
- Plugin system
- Git integration beyond CLI (visual diffs, repo status panels)
- macOS / Linux support

## Vision

If QuakeShell succeeds, it becomes the **open-source MobaXterm** — a full-featured, extensible terminal platform for Windows that starts with the best drop-down experience and grows into:

- **Multi-tab and split-pane** workflows
- **SSH, telnet, and serial** connections with saved session management
- **Theming engine** with community themes
- **Plugin architecture** for custom extensions (SFTP browser, log viewer, API tester, git integration)
- **Multi-shell support** — PowerShell, cmd, Git Bash — switchable per tab (WSL in v1)
- **Cross-platform expansion** to macOS and Linux

The long-term vision: a terminal that developers install once and never need another. QuakeShell starts by solving the "instant access" problem better than anyone, then earns the right to solve everything else.
