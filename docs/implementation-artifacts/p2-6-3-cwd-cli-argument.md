# Story P2-6.3: --cwd CLI Argument

Status: review

## Story

As a user, I want the Explorer context menu to open a new QuakeShell tab in the right-clicked folder, so that I can start a terminal session in any directory without navigating there manually.

## Acceptance Criteria

- **AC1:** Given the context menu command is configured with `quakeshell.exe --cwd "%V"` / When user right-clicks and selects "Open QuakeShell here" / Then QuakeShell launches (or focuses if already running) and opens a new tab with `cwd` set to the right-clicked path
- **AC2:** Given QuakeShell is already running (single-instance lock held) / When a second instance is launched with `--cwd <path>` / Then the second instance forwards the argument to the first instance via `app.requestSingleInstanceLock`; the first instance opens a new tab in that directory and brings the window into view
- **AC3:** Given `app-lifecycle.ts` parses `process.argv` on first-instance startup / When `--cwd <path>` is present / Then `TabManager.createTab({ cwd: resolvedPath })` is called with the validated path
- **AC4:** Given the `--cwd` path does not exist on disk / When the tab is created / Then the PTY spawns in the user's home directory (`os.homedir()`) as a fallback; no crash or unhandled rejection
- **AC5:** Given the `--cwd` path contains spaces / When parsed / Then the full path (including spaces) is handled correctly — Windows Explorer quotes the path via `%V`, so the value arrives as a single argv token after shell expansion
- **AC6:** Given the `--cwd` path contains shell-dangerous characters (`&`, `|`, `;`, backtick, `$`) / When validated / Then those characters do not cause command injection; the path is passed to `createTab` as a plain string, never interpolated into a shell command

## Tasks / Subtasks

### Task 1: Add `parseCwdArg` utility to `app-lifecycle.ts`

- [x] **1.1** Implement `parseCwdArg(argv: string[]): string | null`:
  ```typescript
  function parseCwdArg(argv: string[]): string | null {
    const idx = argv.indexOf('--cwd');
    if (idx === -1 || idx + 1 >= argv.length) return null;
    return argv[idx + 1];
  }
  ```
- [x] **1.2** Implement `resolveCwd(rawPath: string | null): string`:
  ```typescript
  import * as fs from 'fs';
  import * as os from 'os';
  import * as path from 'path';

  function resolveCwd(rawPath: string | null): string {
    if (!rawPath) return os.homedir();
    // Security: strip null bytes and control characters before fs.existsSync
    if (/[\x00-\x1F]/.test(rawPath)) {
      log.warn('--cwd contained illegal characters; falling back to home dir');
      return os.homedir();
    }
    const resolved = path.resolve(rawPath);
    if (!fs.existsSync(resolved)) {
      log.warn(`--cwd path does not exist: ${resolved}; falling back to home dir`);
      return os.homedir();
    }
    return resolved;
  }
  ```
- [x] **1.3** Export `parseCwdArg` and `resolveCwd` for testability (or keep internal and test via integration path in `app-lifecycle` tests)

### Task 2: Handle `--cwd` on first-instance startup

- [x] **2.1** After `app.whenReady()`, parse `process.argv` for `--cwd`:
  ```typescript
  app.whenReady().then(() => {
    const rawCwd = parseCwdArg(process.argv);
    if (rawCwd !== null) {
      const cwd = resolveCwd(rawCwd);
      tabManager.createTab({ cwd });
      windowManager.show();
    }
    // ... rest of startup
  });
  ```
- [x] **2.2** Ensure this block runs **after** `TabManager` and `WindowManager` are initialised
- [x] **2.3** Confirm `windowManager.show()` triggers the same slide-down animation as the hotkey toggle

### Task 3: Handle `--cwd` from second-instance forwarding

- [x] **3.1** Locate the existing `app.on('second-instance', ...)` handler in `app-lifecycle.ts`
- [x] **3.2** Update the handler to parse `commandLine` for `--cwd`:
  ```typescript
  app.on('second-instance', (_event, commandLine, _workingDirectory) => {
    // Existing: focus/show the window
    windowManager.show();

    // New: open tab in the requested cwd
    const rawCwd = parseCwdArg(commandLine);
    if (rawCwd !== null) {
      const cwd = resolveCwd(rawCwd);
      tabManager.createTab({ cwd });
    }
  });
  ```
- [x] **3.3** Confirm `app.requestSingleInstanceLock()` is called before `app.whenReady()` (existing v1 pattern — do not move it)

### Task 4: Update `src/main/app-lifecycle.test.ts`

- [x] **4.1** Write unit tests for `parseCwdArg`:
  - Returns `null` when `--cwd` is absent
  - Returns the next token when `--cwd` is present
  - Returns `null` when `--cwd` is the last token (no following value)
  - Returns the full path including spaces as a single string (argv is pre-split by the OS)
- [x] **4.2** Write unit tests for `resolveCwd`:
  - Returns `os.homedir()` when `rawPath` is `null`
  - Returns resolved absolute path when path exists on disk (mock `fs.existsSync` → `true`)
  - Returns `os.homedir()` when path does not exist (mock `fs.existsSync` → `false`)
  - Returns `os.homedir()` when path contains a null byte
  - Returns `os.homedir()` when path contains other control characters (`\x01`–`\x1F`)
- [x] **4.3** Write integration-style test for first-instance startup with `--cwd`:
  - Mock `process.argv` to include `['', '', '--cwd', 'C:\\Users\\test\\projects']`
  - Verify `tabManager.createTab` is called with `{ cwd: 'C:\\Users\\test\\projects' }`
  - Verify `windowManager.show()` is called
- [x] **4.4** Write test for second-instance handler:
  - Simulate `second-instance` event with `commandLine` containing `--cwd`
  - Verify `tabManager.createTab` is called with resolved path
  - Verify `windowManager.show()` is called even when `--cwd` is absent
- [x] **4.5** Write test: second-instance with non-existent path falls back to `os.homedir()`
- [x] **4.6** Run `npx vitest run src/main/app-lifecycle.test.ts` — all tests green

## Dev Notes

### Architecture Patterns

#### Single-Instance Lock and `second-instance` Event

Electron's single-instance mechanism works as follows:

1. **First instance** calls `app.requestSingleInstanceLock()` → returns `true`, process continues normally.
2. **Second instance** calls `app.requestSingleInstanceLock()` → returns `false`; Electron also fires `second-instance` on the **first** instance, passing the second instance's `process.argv` as `commandLine`.
3. Second instance must call `app.quit()` immediately after receiving `false`.

```typescript
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

app.on('second-instance', (_event, commandLine, _workingDirectory) => {
  windowManager.show(); // Always bring to front
  const rawCwd = parseCwdArg(commandLine);
  if (rawCwd !== null) {
    tabManager.createTab({ cwd: resolveCwd(rawCwd) });
  }
});
```

#### How Windows Explorer Passes the Path

When the user right-clicks a folder, Explorer expands the context menu command:
```
"C:\path\to\quakeshell.exe" --cwd "%V"
```
to (for example):
```
"C:\path\to\quakeshell.exe" --cwd "C:\Users\Alice\My Projects\Foo"
```

Explorer handles the double-quoting of `%V` automatically, so the path — even with spaces — arrives as a **single element** in `process.argv`. No additional splitting or unquoting is needed. However, the implementation must not assume this — it should gracefully handle any single-string value.

#### Path Validation Flow

```
process.argv / commandLine
        │
        ▼
  parseCwdArg()          ← finds --cwd token, returns raw string or null
        │
        ▼
  resolveCwd()
    ├── null?            → os.homedir()
    ├── control chars?   → log.warn + os.homedir()
    ├── path.resolve()   → absolute path (resolves ./ and ../)
    └── fs.existsSync()
          ├── true       → return resolved path
          └── false      → log.warn + os.homedir()
        │
        ▼
  tabManager.createTab({ cwd: resolvedPath })
```

#### Security Notes — `--cwd` Parsing

The `--cwd` value originates from Windows Explorer shell expansion. It is user-influenced (via the folder they right-click) and must be treated as **untrusted input** before being used in any system call.

1. **Null-byte injection** — A null byte in a file-system path can truncate the path at the OS level or confuse APIs. Paths containing `\x00` are rejected in `resolveCwd`.
2. **Control character injection** — Characters `\x01`–`\x1F` are illegal in Windows file names; their presence indicates a malformed or adversarially crafted argument. They are rejected.
3. **Path traversal** — `path.resolve()` normalises `..` sequences to a canonical absolute path, preventing traversal from reaching unexpected locations.
4. **Shell injection via `createTab`** — The resolved `cwd` string is passed to `TabManager.createTab({ cwd })` as a plain JavaScript string, **not** interpolated into any shell command. `node-pty` accepts `cwd` as a spawn option and passes it to the OS `CreateProcess` API, which does not perform shell expansion on this argument. No shell injection risk.
5. **Length limit** — Windows MAX_PATH is 260 characters (or 32,767 with long-path opt-in). Paths exceeding this are unlikely in practice but `fs.existsSync` will return `false` for them, triggering the fallback.
6. **UNC paths (`\\server\share`)** — These are valid on Windows and `path.resolve()` preserves them. `fs.existsSync` handles them correctly. No special treatment needed.
7. **Relative paths in `--cwd`** — These should not appear (Explorer always passes absolute paths) but `path.resolve()` converts them to absolute anyway, relative to the process working directory, which is acceptable.

### Key Files to Create/Modify

| File | Action |
|---|---|
| `src/main/app-lifecycle.ts` | UPDATE — add `parseCwdArg`, `resolveCwd`; handle `--cwd` on startup and in second-instance event |
| `src/main/app-lifecycle.test.ts` | UPDATE — unit tests for parseCwdArg, resolveCwd, first-instance startup, second-instance handler |

### Project Structure Notes

- **Prerequisite:** Epic 2 `TabManager.createTab({ cwd? })` API must be implemented. This story only calls it — it does not modify TabManager.
- **Prerequisite:** P2-6.1 must be complete so the context menu command is registered and actually passes `--cwd` to the exe.
- No new files are created in this story; all changes are in `app-lifecycle.ts` and its test file.
- `WindowManager.show()` — confirm the existing `show()` method initiates the slide-down animation. If the method is named differently, check `src/main/` for the window visibility toggle function used by the hotkey handler.

### References

- [Electron `app.requestSingleInstanceLock`](https://www.electronjs.org/docs/latest/api/app#apprequestsingleinstancelockadditionaldata)
- [Electron `second-instance` event](https://www.electronjs.org/docs/latest/api/app#event-second-instance)
- `tab-manager.ts` — `createTab({ cwd? })` — Epic 2 implementation
- Story P2-6.1 — registry command format (source of `--cwd "%V"` and `--cwd "%1"` in the command key)
- `architecture-v2.md` Decision P2-7 — single-instance forwarding strategy

## Dev Agent Record

### Completion Notes
- Added `--cwd` parsing and resolution for both normal startup and forwarded second-instance launches, including invalid-path fallback to the user's home directory.
- Queued forwarded cwd launches until `TabManager` is initialized and updated the second-instance behavior to reveal and focus the window instead of toggling visibility.
- Propagated cwd values through `TabManager` and `terminalManager.spawnPty` so new tabs actually start in the requested directory.

### Debug Log
- Added unit and integration-style coverage for `parseCwdArg`, `resolveCwd`, startup handling, forwarded launches, and cwd propagation into deferred tab spawns and PTY creation.
- Verified runtime startup with `npm start` and confirmed the registry command values use `--cwd "%1"` and `--cwd "%V"` during the real registry smoke check.
- Confirmed the affected suites and the full `npm test` suite pass after the cwd integration changes.

## File List
- src/main/app-lifecycle.ts
- src/main/app-lifecycle.test.ts
- src/main/index.ts
- src/main/tab-manager.ts
- src/main/tab-manager.test.ts
- src/main/terminal-manager.ts
- src/main/terminal-manager.test.ts

## Change Log
- 2026-04-06: Implemented `--cwd` startup and second-instance handling plus cwd propagation into tab and PTY creation.
