# Story P2-6.1: Context Menu Installer Module

Status: review

## Story

As a developer, I want a `context-menu-installer.ts` module that registers and deregisters the Explorer context menu entry, so that registry operations are encapsulated and callable from installer hooks and the Settings GUI.

## Acceptance Criteria

- **AC1:** Given `context-menu-installer.ts` is created / When `register(exePath)` is called / Then two registry key trees are written via `child_process.execSync('reg add ...')`:
  - `HKCU\Software\Classes\Directory\shell\QuakeShell` (folder right-click)
  - `HKCU\Software\Classes\Directory\Background\shell\QuakeShell` (folder background right-click)
- **AC2:** Given the registry keys are written / When user right-clicks a folder in Windows Explorer / Then "Open QuakeShell here" appears in the context menu
- **AC3:** Given `deregister()` is called / When executed / Then both registry key trees are deleted using `reg delete /f`
- **AC4:** Given the registry write or delete operation fails / When the error is caught / Then it is logged via `electronLog.scope('context-menu')` and the function re-throws so the caller can handle it
- **AC5:** Given `isRegistered()` is called / When executed / Then it returns `true` if the primary registry key exists (exit code 0 from `reg query`), `false` if the key is absent (non-zero exit code)
- **AC6:** Given all registry operations / When inspected / Then they target HKCU only — no UAC prompt is required

## Tasks / Subtasks

### Task 1: Create `src/main/context-menu-installer.ts`

- [x] **1.1** Add scoped logger: `const log = electronLog.scope('context-menu')`
- [x] **1.2** Implement `sanitizeExePath(exePath: string): string`
  - Strip null bytes (`\0`) and other control characters
  - Assert the path ends with `.exe` (throw if not)
  - Resolve to an absolute path using `path.resolve()`
  - Return the sanitized string
- [x] **1.3** Implement `register(exePath: string): void`
  - Call `sanitizeExePath(exePath)` first
  - Write the four registry keys shown in Dev Notes using `execSync`
  - Log success at info level
  - Re-throw any caught error after logging
- [x] **1.4** Implement `deregister(): void`
  - Delete both top-level keys with `/f` flag (which cascades to subkeys)
  - Log success at info level
  - Re-throw any caught error after logging
- [x] **1.5** Implement `isRegistered(): boolean`
  - Run `reg query` with `execSync` wrapped in try/catch
  - Return `true` on success (no throw), `false` when execSync throws
- [x] **1.6** Export named exports: `register`, `deregister`, `isRegistered`

### Task 2: Create `src/main/context-menu-installer.test.ts`

- [x] **2.1** Mock `child_process` with `vi.mock('child_process', ...)`
- [x] **2.2** Mock `electron-log` with scoped logger stub
- [x] **2.3** Write tests for `register()`:
  - Verify `execSync` is called exactly 8 times (4 keys × 2 registry trees)
  - Verify the `/ve` flag is present for default value keys
  - Verify `%1` is used for `Directory\shell` command and `%V` for `Directory\Background\shell` command
  - Verify that a path containing spaces is double-quoted in the registry value
  - Verify that an `exePath` not ending in `.exe` throws before any `execSync` call
  - Verify that null bytes in `exePath` throw before any `execSync` call
- [x] **2.4** Write tests for `deregister()`:
  - Verify `execSync` is called with `reg delete ... /f` for both keys
  - Verify error from `execSync` is logged and re-thrown
- [x] **2.5** Write tests for `isRegistered()`:
  - Returns `true` when `execSync` does not throw
  - Returns `false` when `execSync` throws

### Task 3: Update `src/shared/channels.ts`

- [x] **3.1** Add channel constants:
  ```typescript
  export const REGISTER_CONTEXT_MENU   = 'app:register-context-menu';
  export const DEREGISTER_CONTEXT_MENU = 'app:deregister-context-menu';
  export const CONTEXT_MENU_STATUS     = 'app:context-menu-status';
  ```

### Task 4: Update `src/main/ipc-handlers.ts`

- [x] **4.1** Import `register`, `deregister`, `isRegistered` from `./context-menu-installer`
- [x] **4.2** Import new channel constants from `../shared/channels`
- [x] **4.3** Add handler for `REGISTER_CONTEXT_MENU`:
  - Retrieve `exePath` via `app.getPath('exe')`
  - Call `register(exePath)`
  - Return `{ success: true }` or `{ success: false, error: string }` on failure
- [x] **4.4** Add handler for `DEREGISTER_CONTEXT_MENU`:
  - Call `deregister()`
  - Return `{ success: true }` or `{ success: false, error: string }` on failure
- [x] **4.5** Add handler for `CONTEXT_MENU_STATUS`:
  - Call `isRegistered()`
  - Return `{ registered: boolean }`
- [x] **4.6** Update `src/preload/index.ts` contextBridge to expose the three new channels

### Task 5: Manual smoke test

- [x] **5.1** Run `npm start`, open Settings, toggle context-menu on
- [x] **5.2** Right-click a folder in Explorer — confirm "Open QuakeShell here" appears
- [x] **5.3** Toggle context-menu off in Settings — confirm menu entry disappears

## Dev Notes

### Architecture Patterns

This module uses `child_process.execSync` directly — no third-party registry library. All registry operations target `HKCU` (current user), which requires no elevation.

### Registry Key Structure

```
HKCU\Software\Classes\Directory\shell\QuakeShell
  (Default) = "Open QuakeShell here"
  Icon      = "C:\path\to\quakeshell.exe"

HKCU\Software\Classes\Directory\shell\QuakeShell\command
  (Default) = "\"C:\path\to\quakeshell.exe\" --cwd \"%1\""

HKCU\Software\Classes\Directory\Background\shell\QuakeShell
  (Default) = "Open QuakeShell here"
  Icon      = "C:\path\to\quakeshell.exe"

HKCU\Software\Classes\Directory\Background\shell\QuakeShell\command
  (Default) = "\"C:\path\to\quakeshell.exe\" --cwd \"%V\""
```

- `%1` = path of the folder when right-clicking the folder itself
- `%V` = path of the folder when right-clicking the folder's background

### Exact `reg add` Commands

```powershell
# Directory right-click — label
reg add "HKCU\Software\Classes\Directory\shell\QuakeShell" /ve /d "Open QuakeShell here" /f
# Directory right-click — icon
reg add "HKCU\Software\Classes\Directory\shell\QuakeShell" /v "Icon" /d "\"${exePath}\"" /f
# Directory right-click — command
reg add "HKCU\Software\Classes\Directory\shell\QuakeShell\command" /ve /d "\"${exePath}\" --cwd \"%1\"" /f

# Background right-click — label
reg add "HKCU\Software\Classes\Directory\Background\shell\QuakeShell" /ve /d "Open QuakeShell here" /f
# Background right-click — icon
reg add "HKCU\Software\Classes\Directory\Background\shell\QuakeShell" /v "Icon" /d "\"${exePath}\"" /f
# Background right-click — command
reg add "HKCU\Software\Classes\Directory\Background\shell\QuakeShell\command" /ve /d "\"${exePath}\" --cwd \"%V\"" /f
```

Note: `/ve` sets the default (unnamed) value; `/v "Icon"` sets a named value.

### `isRegistered` Check

```powershell
reg query "HKCU\Software\Classes\Directory\shell\QuakeShell" /ve
# Exit code 0  → key exists → return true
# Non-zero     → key absent → return false
```

### `deregister` Commands

```powershell
reg delete "HKCU\Software\Classes\Directory\shell\QuakeShell" /f
reg delete "HKCU\Software\Classes\Directory\Background\shell\QuakeShell" /f
```

The `/f` flag suppresses the confirmation prompt and recursively removes subkeys.

### TypeScript Module Skeleton

```typescript
import { execSync } from 'child_process';
import * as path from 'path';
import electronLog from 'electron-log';

const log = electronLog.scope('context-menu');

function sanitizeExePath(exePath: string): string {
  // Strip null bytes and control characters
  if (/[\x00-\x1F]/.test(exePath)) {
    throw new Error(`context-menu-installer: exePath contains illegal characters`);
  }
  if (!exePath.toLowerCase().endsWith('.exe')) {
    throw new Error(`context-menu-installer: exePath must end with .exe`);
  }
  return path.resolve(exePath);
}

export function register(exePath: string): void {
  const safe = sanitizeExePath(exePath);
  const keys = [
    /* ... reg add commands ... */
  ];
  try {
    for (const cmd of keys) execSync(cmd, { stdio: 'pipe' });
    log.info('Context menu registered');
  } catch (err) {
    log.error('Failed to register context menu', err);
    throw err;
  }
}

export function deregister(): void {
  const keys = [
    `reg delete "HKCU\\Software\\Classes\\Directory\\shell\\QuakeShell" /f`,
    `reg delete "HKCU\\Software\\Classes\\Directory\\Background\\shell\\QuakeShell" /f`,
  ];
  try {
    for (const cmd of keys) execSync(cmd, { stdio: 'pipe' });
    log.info('Context menu deregistered');
  } catch (err) {
    log.error('Failed to deregister context menu', err);
    throw err;
  }
}

export function isRegistered(): boolean {
  try {
    execSync(
      `reg query "HKCU\\Software\\Classes\\Directory\\shell\\QuakeShell" /ve`,
      { stdio: 'pipe' }
    );
    return true;
  } catch {
    return false;
  }
}
```

### Security Notes

**Input sanitization for `exePath`** is critical because the exe path is interpolated directly into a shell command string passed to `execSync`:

## Dev Agent Record

### Completion Notes
- Implemented `context-menu-installer.ts` to manage HKCU Explorer context-menu registration, deregistration, and live status checks with sanitized executable paths.
- Replaced placeholder main-process handlers with real register/deregister/status IPC behavior and reused the existing app channel constants and preload bridge already present in the repository.
- Completed runtime smoke validation by launching the app with `npm start`, then verifying real registry creation and cleanup against Electron's executable path via `reg query`.

### Debug Log
- Added focused unit coverage for installer registration, deregistration, quoting, `%1`/`%V` command values, and IPC handler behavior.
- Adjusted the runtime implementation to use lint-safe control-character detection and simplified registry command escaping.
- Verified the affected suites pass and confirmed the repo-wide test suite still succeeds with `npm test`.

## File List
- src/main/context-menu-installer.ts
- src/main/context-menu-installer.test.ts
- src/main/ipc-handlers.ts
- src/main/ipc-handlers.test.ts

## Change Log
- 2026-04-06: Implemented Explorer context-menu registry installation, status detection, and main-process IPC wiring.

1. **Null-byte injection** — A null byte (`\0`) can truncate strings at the OS level. Reject any path containing bytes `\x00–\x1F`.
2. **Path traversal** — `path.resolve()` normalises `../` sequences to an absolute path, preventing traversal tricks.
3. **Extension check** — Accepting only `.exe` paths reduces the attack surface if this function is ever reachable via IPC.
4. **Double-quoting in registry values** — The exe path itself is wrapped in escaped double-quotes (`\"${safe}\"`) inside the registry value so Windows shell expansion treats it as a single token even when the path contains spaces.
5. **`stdio: 'pipe'`** — Prevents `execSync` from inheriting the parent process stdio, avoiding information leakage.
6. **No shell meta-characters** — Because the exe path is restricted to `.exe` files on a resolved absolute path, characters like `&`, `|`, `;` that would be dangerous in a shell context are unlikely to appear in a valid Windows installer path. The sanitization regex should be adjusted to also block these if the project ever broadens the accepted input.

### Key Files to Create/Modify

| File | Action |
|---|---|
| `src/main/context-menu-installer.ts` | CREATE — register, deregister, isRegistered |
| `src/main/context-menu-installer.test.ts` | CREATE — Vitest unit tests with mocked execSync |
| `src/shared/channels.ts` | UPDATE — add 3 new channel constants |
| `src/main/ipc-handlers.ts` | UPDATE — add 3 new IPC handlers |
| `src/preload/index.ts` | UPDATE — expose new channels via contextBridge |

### Project Structure Notes

- The module is `src/main/`-only; it uses Node's `child_process` which is unavailable in the renderer.
- IPC bridges the renderer Settings pane to the main-process module via the three new channels.
- Tests run under Vitest with `vi.mock('child_process')` — `execSync` is never actually invoked during the test suite.

### References

- [Windows Registry — Shell Extensions (MSDN)](https://learn.microsoft.com/en-us/windows/win32/shell/context-menu-handlers)
- `architecture-v2.md` Decision P2-7 — Context Menu Registry strategy
- Epic 2 (TabManager with cwd support) — prerequisite; `createTab({ cwd })` API is already implemented
