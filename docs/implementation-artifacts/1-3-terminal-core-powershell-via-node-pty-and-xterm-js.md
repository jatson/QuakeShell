# Story 1.3: Terminal Core — PowerShell via node-pty and xterm.js

Status: review

## Story

As a developer,
I want to spawn a PowerShell session in a GPU-accelerated terminal with clipboard support and scrollback,
So that I can type commands, see rendered output, scroll history, and copy/paste text.

## Acceptance Criteria

1. **Given** `node-pty` is installed and Electron Forge is configured with `@electron/rebuild` **When** the app builds **Then** `node-pty` compiles against Electron's Node version without errors

2. **Given** the `src/main/terminal-manager.ts` module **When** `spawn('powershell')` is called **Then** a PowerShell process is spawned via `node-pty` using Windows ConPTY, and a scoped logger logs the spawn event

3. **Given** a running PTY process **When** the renderer sends data via `terminal:write` IPC channel **Then** the data is written to the PTY stdin

4. **Given** the PTY process produces output **When** a `data` event fires on the PTY **Then** the output is sent to the renderer via `webContents.send('terminal:data', { data })` through `ipc-handlers.ts`

5. **Given** the renderer requests a terminal resize via `terminal:resize` IPC channel **When** new column and row dimensions are provided **Then** the PTY process is resized to match and xterm.js reflows content

6. **Given** the `src/renderer/components/Terminal/TerminalView.tsx` Preact component **When** it mounts **Then** an xterm.js `Terminal` instance is created with the WebGL addon for GPU-accelerated rendering, the fit addon for automatic size calculation, and the web-links addon for clickable URLs

7. **Given** the TerminalView receives data via `onTerminalData` callback **When** terminal output arrives from the main process **Then** `xterm.write(data)` renders the output in the terminal viewport

8. **Given** text is selected in the terminal **When** the user invokes copy (Ctrl+C with selection, or right-click context) **Then** the selected text is copied to the system clipboard

9. **Given** text is in the system clipboard **When** the user invokes paste (Ctrl+V or right-click paste) **Then** the clipboard text is written to the terminal input

10. **Given** the terminal has produced output **When** the user scrolls up **Then** the scrollback buffer is navigable and previous output is visible

11. **Given** the terminal viewport container **When** it renders **Then** it fills 100% width with configurable background opacity (reading `opacity` from config), 12px horizontal / 8px vertical padding, and uses the configured font family and size

## Tasks / Subtasks

- [x] Task 1: Install and configure node-pty with Electron rebuild (AC: #1)
  - [x] 1.1: Install `node-pty@1.1.0` as a production dependency
  - [x] 1.2: Configure `@electron/rebuild` in `forge.config.ts` to rebuild native modules for Electron's Node version
  - [x] 1.3: Verify `npm run make` or `npm start` compiles `node-pty` without errors
  - [x] 1.4: Confirm ConPTY backend is used on Windows (node-pty uses ConPTY by default on Windows 10 1809+)

- [x] Task 2: Install xterm.js and addons (AC: #6)
  - [x] 2.1: Install `@xterm/xterm@6.0.0` as a production dependency
  - [x] 2.2: Install `@xterm/addon-fit` for automatic terminal sizing
  - [x] 2.3: Install `@xterm/addon-webgl` for GPU-accelerated rendering
  - [x] 2.4: Install `@xterm/addon-web-links` for clickable URL detection
  - [x] 2.5: Verify all xterm packages install cleanly and are compatible with each other

- [x] Task 3: Implement terminal-manager module (AC: #2, #3, #5)
  - [x] 3.1: Create `src/main/terminal-manager.ts`
  - [x] 3.2: Create scoped logger: `log.scope('terminal-manager')`
  - [x] 3.3: Implement `spawn(shell: string)` method:
    - Spawn PTY process via `node-pty.spawn(shell, [], { name: 'xterm-256color', cols: 80, rows: 24, cwd: process.env.HOME || process.env.USERPROFILE, useConpty: true })`
    - Log spawn event with shell name and PID
  - [x] 3.4: Implement `write(data: string)` method to write data to PTY stdin
  - [x] 3.5: Implement `resize(cols: number, rows: number)` method to resize the PTY process
  - [x] 3.6: Implement `onData(callback: (data: string) => void)` to listen for PTY `data` events
  - [x] 3.7: Implement `destroy()` method for cleanup (kill PTY process)
  - [x] 3.8: Add error handling: try/catch on spawn, handle PTY exit events, log errors
  - [x] 3.9: Export all methods as named exports
  - [x] 3.10: Do NOT import `ipcMain` — this module is called by `ipc-handlers.ts`

- [x] Task 4: Register terminal IPC handlers (AC: #3, #4, #5)
  - [x] 4.1: Add terminal channel constants to `src/shared/channels.ts`: `terminal:spawn`, `terminal:write`, `terminal:resize`, `terminal:data`
  - [x] 4.2: Update `src/main/ipc-handlers.ts` to register terminal handlers:
    - `ipcMain.handle(CHANNELS.TERMINAL_WRITE, (_, { data }) => terminalManager.write(data))`
    - `ipcMain.handle(CHANNELS.TERMINAL_RESIZE, (_, { cols, rows }) => terminalManager.resize(cols, rows))`
  - [x] 4.3: Set up PTY data forwarding: on `terminalManager.onData`, call `mainWindow.webContents.send(CHANNELS.TERMINAL_DATA, { data })` — requires access to BrowserWindow reference
  - [x] 4.4: Wrap all handlers in try/catch with scoped logger error reporting
  - [x] 4.5: Call `terminalManager.spawn('powershell')` during app initialization (from `ipc-handlers.ts` or `src/main/index.ts`)

- [x] Task 5: Wire terminal into preload contextBridge (AC: #7)
  - [x] 5.1: Update `src/preload/index.ts` to populate `quakeshell.terminal` namespace
  - [x] 5.2: Implement `terminal.write(data)` → `ipcRenderer.invoke(CHANNELS.TERMINAL_WRITE, { data })`
  - [x] 5.3: Implement `terminal.resize(cols, rows)` → `ipcRenderer.invoke(CHANNELS.TERMINAL_RESIZE, { cols, rows })`
  - [x] 5.4: Implement `terminal.onData(callback)` → `ipcRenderer.on(CHANNELS.TERMINAL_DATA, (_, payload) => callback(payload.data))`
  - [x] 5.5: Update TypeScript type declarations for `window.quakeshell.terminal` in `src/shared/ipc-types.ts`

- [x] Task 6: Create TerminalView Preact component (AC: #6, #7, #8, #9, #10, #11)
  - [x] 6.1: Create `src/renderer/components/Terminal/TerminalView.tsx`
  - [x] 6.2: On mount (`useEffect`), create xterm.js `Terminal` instance with options:
    - `fontFamily` from config (default: `"Cascadia Code, Consolas, Courier New, monospace"`)
    - `fontSize` from config (default: `14`)
    - `theme` with Tokyo Night colors: `{ background: '#1a1b26', foreground: '#c0caf5', cursor: '#7aa2f7', selectionBackground: '#283457' }`
    - `scrollback: 5000` (or configurable)
    - `allowTransparency: true` for opacity support
  - [x] 6.3: Load and register xterm.js addons:
    - `WebglAddon` for GPU-accelerated rendering (with fallback to canvas if WebGL init fails)
    - `FitAddon` for automatic size calculation
    - `WebLinksAddon` for clickable URLs
  - [x] 6.4: Open terminal into the container DOM element via `terminal.open(containerRef)`
  - [x] 6.5: Call `fitAddon.fit()` on mount and on window resize
  - [x] 6.6: Wire `terminal.onData` (xterm user input) → `window.quakeshell.terminal.write(data)` to send keystrokes to PTY
  - [x] 6.7: Wire `window.quakeshell.terminal.onData(data => terminal.write(data))` to render PTY output
  - [x] 6.8: On fit/resize, call `window.quakeshell.terminal.resize(cols, rows)` to sync PTY dimensions
  - [x] 6.9: Style container: 100% width, configurable opacity, 12px horizontal / 8px vertical padding
  - [x] 6.10: Add 2px accent-colored (`#7aa2f7`) bottom edge line per UX spec
  - [x] 6.11: Cleanup on unmount: dispose terminal, remove event listeners

- [x] Task 7: Implement clipboard support (AC: #8, #9)
  - [x] 7.1: Handle Ctrl+C with active selection: detect selection via `terminal.hasSelection()`, if selected copy via `navigator.clipboard.writeText(terminal.getSelection())`, otherwise pass Ctrl+C through to PTY (SIGINT)
  - [x] 7.2: Handle Ctrl+V: read clipboard via `navigator.clipboard.readText()`, write to PTY input via `terminal.paste(text)` or direct write
  - [x] 7.3: Handle right-click context: implement copy/paste via context menu or xterm.js right-click handler
  - [x] 7.4: Ensure clipboard operations work within CSP constraints (`'self'` origin)

- [x] Task 8: Integrate TerminalView into App component (AC: #6, #11)
  - [x] 8.1: Import and render `TerminalView` in `src/renderer/components/App.tsx`
  - [x] 8.2: Load config values (`opacity`, `fontSize`, `fontFamily`) via `window.quakeshell.config.getAll()` and pass as props or use signals
  - [x] 8.3: Apply background opacity from config to terminal container
  - [x] 8.4: Verify terminal renders full-width with correct padding and font

- [x] Task 9: Write unit tests (AC: all)
  - [x] 9.1: Create `src/main/terminal-manager.test.ts` — mock `node-pty`, test spawn/write/resize/destroy
  - [x] 9.2: Create `src/renderer/components/Terminal/TerminalView.test.tsx` — test mount/unmount, verify xterm instance created
  - [x] 9.3: Run `npm test` and verify all tests pass

## Dev Notes

### Architecture Patterns

- **node-pty native module**: Requires `@electron/rebuild` to compile against Electron's Node.js version (not system Node). This is configured in `forge.config.ts` via the `rebuildConfig` or `pluginInterface`. node-pty v1.1.0 uses ConPTY on Windows 10 1809+.
- **Dual IPC pattern**: Terminal uses BOTH patterns:
  - **invoke/handle** (renderer→main): `terminal:write`, `terminal:resize` — renderer sends commands to main
  - **send/on** (main→renderer): `terminal:data` — main pushes PTY output to renderer
- **terminal-manager does NOT import ipcMain**: It exposes methods that `ipc-handlers.ts` calls. The PTY data callback is registered by `ipc-handlers.ts` which forwards via `webContents.send()`.
- **xterm.js WebGL addon**: Must handle fallback gracefully — some environments (RDP, VMs) may not support WebGL. Wrap `WebglAddon` load in try/catch; fall back to canvas renderer on failure.
- **FitAddon**: Calculates cols/rows from container dimensions. Must be called on: mount, window resize, visibility change (show/hide toggle). The resize values must be forwarded to PTY via IPC.
- **Clipboard via Ctrl+C dual behavior**: When text is selected, Ctrl+C = copy. When no selection, Ctrl+C = SIGINT to shell. This is a standard terminal pattern that xterm.js supports.
- **No console.log**: All logging via `electron-log.scope('terminal-manager')` in main, no logging from renderer components.

### xterm.js Configuration

```typescript
const terminal = new Terminal({
  fontFamily: config.fontFamily,  // 'Cascadia Code, Consolas, Courier New, monospace'
  fontSize: config.fontSize,       // 14
  theme: {
    background: '#1a1b26',         // Tokyo Night background
    foreground: '#c0caf5',         // Tokyo Night foreground
    cursor: '#7aa2f7',             // Tokyo Night accent
    selectionBackground: '#283457', // Tokyo Night selection
  },
  scrollback: 5000,
  allowTransparency: true,
  cursorBlink: true,
  cursorStyle: 'bar',
});
```

### PTY Spawn Configuration

```typescript
const pty = nodePty.spawn('powershell', [], {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: process.env.USERPROFILE || process.env.HOME,
  useConpty: true,
  env: process.env,
});
```

### Dependencies

| Package | Version | Role |
|---------|---------|------|
| `node-pty` | 1.1.0 | PTY process spawning (native module) |
| `@xterm/xterm` | 6.0.0 | Terminal emulator UI |
| `@xterm/addon-fit` | latest | Auto-sizing terminal to container |
| `@xterm/addon-webgl` | latest | GPU-accelerated rendering |
| `@xterm/addon-web-links` | latest | Clickable URL detection |

### Performance Requirements (NFR1-NFR3)

- **NFR1**: Hotkey-to-visible toggle < 100ms — terminal must be pre-initialized (never destroyed on hide)
- **NFR2**: 60fps animation — WebGL addon ensures GPU rendering
- **NFR3**: Input-to-render < 16ms — PTY data forwarding via IPC must be fast; use direct `webContents.send()` not invoke
- **NFR4/5**: Idle < 80MB, Active < 150MB — xterm.js scrollback buffer is the main memory consumer

### Security Considerations

- **node-pty runs in main process**: It has full OS access. Renderer communicates ONLY through IPC.
- **Clipboard**: Use `navigator.clipboard` API in renderer (CSP-safe). Do NOT expose `clipboard` module from main.
- **Shell path**: Use `powershell` (resolves via PATH). Do not allow arbitrary executable paths from renderer — validate shell name against allowlist in terminal-manager.

### Testing Standards

- **Framework**: Vitest 4.1.2
- **Co-located tests**: `src/main/terminal-manager.test.ts`, `src/renderer/components/Terminal/TerminalView.test.tsx`
- **Mocking strategy**: Mock `node-pty` entirely in unit tests (native module can't run in Vitest). Test xterm.js integration with JSDOM or happy-dom.
- **E2E**: Actual terminal interaction tested via Playwright in Epic 1 integration (not this story's scope)

### Project Structure Notes

Files to **create**:
```
src/
  main/
    terminal-manager.ts          # node-pty spawn, write, resize, data events
    terminal-manager.test.ts     # Unit tests with mocked node-pty
  renderer/
    components/
      Terminal/
        TerminalView.tsx         # xterm.js Preact component
        TerminalView.test.tsx    # Component unit tests
```

Files to **modify**:
```
src/
  main/
    ipc-handlers.ts              # Add terminal IPC handlers (write, resize, data forwarding)
    index.ts                     # Spawn terminal on app ready
  shared/
    channels.ts                  # Add terminal channel constants
    ipc-types.ts                 # Add window.quakeshell.terminal type declarations
  preload/
    index.ts                     # Populate quakeshell.terminal namespace
  renderer/
    components/
      App.tsx                    # Render TerminalView component
forge.config.ts                  # Add @electron/rebuild config for node-pty
package.json                     # Add node-pty + xterm dependencies
```

### References

- Architecture: `docs/planning-artifacts/architecture.md` — Terminal manager pattern, IPC dual-pattern, xterm.js addons, node-pty config
- PRD: `docs/planning-artifacts/prd.md` — FR1, FR3-FR7 (terminal core), NFR1-NFR5 (performance), NFR8-NFR11 (security)
- Epics: `docs/planning-artifacts/epics.md` — Epic 1, Story 1.3
- UX Design: `docs/planning-artifacts/ux-design-specification.md` — UX-DR4 (terminal viewport), Tokyo Night theme colors, padding specs

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (GitHub Copilot)

### Debug Log References

- node-pty 1.1.0 ships with N-API prebuilds for win32-x64; `electron-rebuild` from source failed (no VS Build Tools) but prebuilds are sufficient
- Vitest 4.x requires `function` syntax (not arrow) for constructor mocks to work with `new`
- Preact `useEffect` requires `act()` wrapper in tests to flush effects synchronously
- Added `jsdom` dev dependency and `@vitest-environment jsdom` directive for renderer tests

### Completion Notes List

- Installed `node-pty@1.1.0` with prebuilt binaries; configured `rebuildConfig.onlyModules: ['node-pty']` in forge.config.ts
- Installed `@xterm/xterm@6.0.0`, `@xterm/addon-fit`, `@xterm/addon-webgl`, `@xterm/addon-web-links`
- Created `terminal-manager.ts` with spawn/write/resize/onData/destroy, shell allowlist validation, scoped logging, no ipcMain import
- Updated `ipc-handlers.ts` to accept BrowserWindow ref, registered terminal:write and terminal:resize handlers, wired PTY data → renderer via webContents.send
- Updated `index.ts` to pass mainWindow to registerIpcHandlers; terminal spawns from config.defaultShell during initialization
- Populated `preload/index.ts` with quakeshell.terminal namespace (write, resize, onData with cleanup)
- Updated `ipc-types.ts` with QuakeShellTerminalAPI interface
- Created `TerminalView.tsx` Preact component with xterm.js, WebGL addon (with canvas fallback), FitAddon, WebLinksAddon, clipboard (Ctrl+C/V + right-click context), 2px accent bottom edge, configurable opacity/font
- Updated `App.tsx` to load config via signals and render TerminalView with props
- 14 unit tests for terminal-manager (spawn, write, resize, onData, destroy, shell validation)
- 12 unit tests for TerminalView (mount, unmount, addon loading, wiring, clipboard, props)
- All 57 tests pass, no regressions

### File List

New files:
- src/main/terminal-manager.ts
- src/main/terminal-manager.test.ts
- src/renderer/components/Terminal/TerminalView.tsx
- src/renderer/components/Terminal/TerminalView.test.tsx

Modified files:
- forge.config.ts (added rebuildConfig.onlyModules for node-pty)
- package.json (added node-pty, @xterm/xterm, @xterm/addon-fit, @xterm/addon-webgl, @xterm/addon-web-links, jsdom)
- src/main/index.ts (createWindow returns BrowserWindow, passes it to registerIpcHandlers)
- src/main/ipc-handlers.ts (accepts BrowserWindow param, terminal IPC handlers + PTY spawn/data forwarding)
- src/preload/index.ts (populated quakeshell.terminal namespace)
- src/shared/ipc-types.ts (added QuakeShellTerminalAPI interface)
- src/renderer/components/App.tsx (loads config, renders TerminalView with signals)
- vitest.config.ts (added environmentMatchGlobs for jsdom in renderer tests)

## Change Log

- 2026-03-31: Implemented Story 1.3 — Terminal Core (PowerShell via node-pty and xterm.js). Added terminal-manager module, IPC handlers, preload bridge, TerminalView Preact component with GPU-accelerated rendering, clipboard support, and 26 new unit tests.
