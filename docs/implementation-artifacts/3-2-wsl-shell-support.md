# Story 3.2: WSL Shell Support

Status: review

## Story

As a developer,
I want to run a WSL distribution shell in QuakeShell,
So that I can use my Linux environment without switching to a separate terminal application.

## Acceptance Criteria

1. **Given** the `defaultShell` config value is set to `"wsl"` **When** a terminal session is spawned **Then** `terminal-manager.ts` spawns a WSL shell via node-pty using the `wsl.exe` command

2. **Given** a WSL shell is running **When** the user types Linux commands (e.g., `ls`, `cat`, `grep`) **Then** the commands execute in the default WSL distribution and output renders correctly in xterm.js

3. **Given** a WSL shell is running **When** the terminal renders output with ANSI color codes **Then** colors display correctly through xterm.js (same as PowerShell output rendering)

4. **Given** WSL is not installed on the system **When** the app attempts to spawn a WSL shell **Then** the terminal displays an error message `[Failed to start shell: WSL is not installed or not available]` in dimmed text **And** the failure is logged via the scoped logger

5. **Given** the `defaultShell` config accepts custom paths **When** a value like `"C:\\Git\\bin\\bash.exe"` is configured **Then** terminal-manager spawns that executable as the shell process

## Tasks / Subtasks

- [x] Task 1: Extend shell resolution logic in terminal-manager (AC: #1, #5)
  - [x] 1.1: In `src/main/terminal-manager.ts`, refactor the shell-spawning logic to support multiple shell types via a shell resolver function
  - [x] 1.2: Implement `resolveShellPath(shellConfig: string): { command: string; args: string[] }` that maps config values to executable paths:
    - `"powershell"` → `{ command: 'powershell.exe', args: [] }`
    - `"pwsh"` → `{ command: 'pwsh.exe', args: [] }`
    - `"wsl"` → `{ command: 'wsl.exe', args: [] }`
    - `"cmd"` → `{ command: 'cmd.exe', args: [] }`
    - Custom path (e.g., `"C:\\Git\\bin\\bash.exe"`) → `{ command: customPath, args: [] }`
  - [x] 1.3: Update the `spawnTerminal()` function to use `resolveShellPath()` instead of hardcoded PowerShell path
  - [x] 1.4: Read `defaultShell` from config-store to determine which shell to spawn

- [x] Task 2: Implement WSL-specific spawning via node-pty (AC: #1, #2, #3)
  - [x] 2.1: Spawn WSL shell using `pty.spawn('wsl.exe', [], { ... })` with appropriate environment variables
  - [x] 2.2: Set `env` to include `COLORTERM: 'truecolor'` and `TERM: 'xterm-256color'` for proper ANSI color support in WSL
  - [x] 2.3: Ensure the WSL shell receives the correct terminal dimensions (cols/rows) from the xterm.js fit addon
  - [x] 2.4: Verify that Linux-specific control sequences (cursor movement, color codes, line discipline) pass through node-pty correctly to xterm.js

- [x] Task 3: Implement WSL availability detection and error handling (AC: #4)
  - [x] 3.1: Before spawning a WSL shell, check if `wsl.exe` is available by attempting to resolve its path or running a pre-flight check
  - [x] 3.2: If WSL is not available, write `[Failed to start shell: WSL is not installed or not available]` to the xterm.js terminal in dimmed text using `\x1b[38;2;86;95;137m` (the `--fg-dimmed` / `#565f89` ANSI escape)
  - [x] 3.3: Log the failure via `log.scope('terminal-manager').error(...)` with details about the WSL detection result
  - [x] 3.4: Handle `pty.spawn()` errors (ENOENT, EACCES) gracefully — catch the error and display the dimmed error message instead of crashing

- [x] Task 4: Implement custom shell path validation (AC: #5)
  - [x] 4.1: When `defaultShell` is a custom file path, validate the path exists using `fs.existsSync()` before spawning
  - [x] 4.2: If the custom path does not exist, display `[Failed to start shell: Shell executable not found at <path>]` in dimmed text
  - [x] 4.3: Log the missing path via scoped logger

- [x] Task 5: Update config schema for shell types (AC: #1, #5)
  - [x] 5.1: Ensure `defaultShell` in `src/shared/config-schema.ts` accepts both predefined shell names (`"powershell"`, `"pwsh"`, `"wsl"`, `"cmd"`) and arbitrary string paths
  - [x] 5.2: The Zod schema should use `z.string().default('powershell')` — the string value is validated at runtime by the shell resolver, not constrained by the schema itself

- [x] Task 6: Unit and integration testing (AC: #1–#5)
  - [x] 6.1: Create/extend `src/main/terminal-manager.test.ts` — test `resolveShellPath()` for all predefined shell types and custom paths
  - [x] 6.2: Test WSL spawn: mock `pty.spawn('wsl.exe', ...)`, verify correct args and env variables
  - [x] 6.3: Test WSL unavailable: mock `pty.spawn()` throwing ENOENT, verify error message written to xterm.js buffer
  - [x] 6.4: Test custom path: mock `fs.existsSync()` returning false, verify error message displayed
  - [x] 6.5: Test ANSI color pass-through: verify that data from node-pty with ANSI escape codes is forwarded unmodified to xterm.js

## Dev Notes

### Architecture Patterns

- **Shell resolver pattern**: The `resolveShellPath()` function centralizes all shell-type-to-executable mapping logic. This makes it easy to add new shell types in the future and keeps the spawning logic clean.
- **node-pty spawning**: node-pty's `spawn()` accepts a command string and args array. For WSL, the command is `wsl.exe` with no additional args (it launches the default distribution). For custom paths, the command is the full executable path.
- **WSL environment variables**: WSL shells need `TERM=xterm-256color` and `COLORTERM=truecolor` to enable proper ANSI color rendering. These should be merged with the existing environment variables passed to node-pty.
- **Error display in dimmed text**: When a shell fails to start, the error message is written directly to the xterm.js terminal buffer using ANSI escape codes for the dimmed color (`#565f89`). This follows the same pattern used in Story 3.4 for process exit messages.
- **Graceful error handling**: Shell spawn failures are caught at the `pty.spawn()` call site. The error is displayed in the terminal and logged — the app does not crash. The user can change the config to a valid shell and the next spawn will use the new value.
- **Config hot-reload**: If `defaultShell` changes via hot-reload (Story 2.1), the new value takes effect on the next shell spawn (e.g., restart after exit or new tab). Running shells are not killed.

### Shell Resolution Map

```
Config Value          → Command           → Args
────────────────────────────────────────────────
"powershell"          → powershell.exe    → []
"pwsh"                → pwsh.exe          → []
"wsl"                 → wsl.exe           → []
"cmd"                 → cmd.exe           → []
"C:\\Git\\bin\\bash"  → C:\Git\bin\bash   → []
```

### WSL Spawn Configuration

```typescript
pty.spawn('wsl.exe', [], {
  name: 'xterm-256color',
  cols: terminalCols,
  rows: terminalRows,
  cwd: process.env.USERPROFILE,
  env: {
    ...process.env,
    COLORTERM: 'truecolor',
    TERM: 'xterm-256color',
  },
});
```

### Dependencies

| Package | Version | Role in this story |
|---------|---------|-------------------|
| `node-pty` | 1.1.0-beta22 | Shell process spawning for WSL and custom shells |
| `@xterm/xterm` | 5.7.0 | Terminal rendering with ANSI color support |
| `electron-store` | 11.0.2 | Reading `defaultShell` config value |
| `zod` | 4.3.6 | Config schema validation for `defaultShell` |
| `electron-log` | 5.4.3 | Scoped error logging |
| `vitest` | 4.1.2 | Unit testing |

### Testing Standards

- **Framework**: Vitest 4.1.2
- **Co-located tests**: `src/main/terminal-manager.test.ts` next to source
- **Mocking**: Mock `pty.spawn()` for all shell types, mock `fs.existsSync()` for custom path validation, mock xterm.js write for error messages
- **Coverage targets**: All shell resolver branches, WSL spawn with correct env, error handling for unavailable shells, custom path validation

### Project Structure Notes

Files to **create**:
```
(No new files — this story extends existing modules)
```

Files to **modify**:
```
src/
  main/
    terminal-manager.ts         # Add resolveShellPath(), WSL spawning, error handling
    terminal-manager.test.ts    # Add shell resolver tests, WSL spawn tests, error handling tests
  shared/
    config-schema.ts            # Verify defaultShell accepts string values including "wsl"
```

### References

- Architecture: [`architecture.md`](docs/planning-artifacts/architecture.md) — Terminal manager module, node-pty integration, error handling patterns
- PRD: [`prd.md`](docs/planning-artifacts/prd.md) — FR22 (WSL shell support), FR23 (custom shell paths)
- Epics: [`epics.md`](docs/planning-artifacts/epics.md) — Epic 3, Story 3.2
- UX Design: [`ux-design-specification.md`](docs/planning-artifacts/ux-design-specification.md) — UX-DR27 (shell exit handling), dimmed text color specification
- Story 1.3 (prerequisite): [`1-3-terminal-core-powershell-via-node-pty-and-xterm-js.md`](docs/implementation-artifacts/1-3-terminal-core-powershell-via-node-pty-and-xterm-js.md) — terminal-manager.ts, node-pty spawn, xterm.js integration
- Story 2.4 (prerequisite): [`2-4-shell-selection-and-animation-speed.md`](docs/implementation-artifacts/2-4-shell-selection-and-animation-speed.md) — Shell selection config, defaultShell field

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
None — all tests pass (38/38 in terminal-manager.test.ts, 195/195 full suite)

### Completion Notes List
- All tasks were already implemented in a prior session alongside Story 3.1 work
- `resolveShellPath()` maps allowlisted shells (powershell, pwsh, wsl, cmd, bash) and passes through custom paths
- WSL-specific env vars (COLORTERM=truecolor, TERM=xterm-256color) added via `buildSpawnEnv()`
- Error handling: try/catch around `pty.spawn()` with dimmed ANSI error messages for WSL-not-available and generic spawn failures
- Custom path validation: `fs.existsSync()` check before spawning non-allowlisted shells
- Config schema: `defaultShell: z.string().default('powershell')` — runtime validation via shell resolver
- 38 tests covering all acceptance criteria: shell resolution, WSL spawn env, error handling, custom paths, ANSI pass-through

### Change Log
- All implementation completed in prior session (2026-03-31)
- Story finalized and marked review (2026-03-31)

### File List
- `src/main/terminal-manager.ts` — shell resolver, WSL spawn, error handling, custom path validation
- `src/main/terminal-manager.test.ts` — 38 tests covering all ACs
- `src/shared/config-schema.ts` — `defaultShell: z.string().default('powershell')` (unchanged, already correct)
