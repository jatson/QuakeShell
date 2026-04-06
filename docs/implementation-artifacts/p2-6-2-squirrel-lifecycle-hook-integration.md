# Story P2-6.2: Squirrel Lifecycle Hook Integration

Status: review

## Story

As a developer, I want the context menu entry to be automatically registered on install and deregistered on uninstall, so that users who install via Squirrel get the feature without opening Settings.

## Acceptance Criteria

- **AC1:** Given Squirrel passes `--squirrel-install` at install time / When `app-lifecycle.ts` handles the flag / Then `ContextMenuInstaller.register(process.execPath)` is called; any error is logged but does not block the install flow
- **AC2:** Given Squirrel passes `--squirrel-updated` at update time / When handled / Then `ContextMenuInstaller.register(process.execPath)` is called to ensure registry entries point to the current exe path
- **AC3:** Given Squirrel passes `--squirrel-uninstall` at uninstall time / When handled / Then `ContextMenuInstaller.deregister()` is called; any error is logged but does not block the uninstall flow
- **AC4:** Given the existing v1 Squirrel handler in `app-lifecycle.ts` / When updated / Then single-instance lock, tray cleanup, and all other existing v1 Squirrel behaviour remain unchanged and no regression is introduced
- **AC5:** Given the app starts normally (no Squirrel flag) / When `app-lifecycle.ts` runs / Then no registry operations are performed

## Tasks / Subtasks

### Task 1: Update `src/main/app-lifecycle.ts`

- [x] **1.1** Import named exports from `./context-menu-installer`:
  ```typescript
  import { register as registerContextMenu, deregister as deregisterContextMenu } from './context-menu-installer';
  ```
- [x] **1.2** Locate the existing Squirrel flag check block (early `process.argv` inspection before `app.ready`)
- [x] **1.3** In the `--squirrel-install` branch, add after existing install logic:
  ```typescript
  try {
    registerContextMenu(process.execPath);
    log.info('Context menu registered on install');
  } catch (err) {
    log.error('Context menu registration failed during install (non-fatal)', err);
  }
  ```
- [x] **1.4** In the `--squirrel-updated` branch, add the same `try/catch` block calling `registerContextMenu(process.execPath)`
- [x] **1.5** In the `--squirrel-uninstall` branch, add after existing uninstall logic:
  ```typescript
  try {
    deregisterContextMenu();
    log.info('Context menu deregistered on uninstall');
  } catch (err) {
    log.error('Context menu deregistration failed during uninstall (non-fatal)', err);
  }
  ```
- [x] **1.6** Verify the scoped logger at the top of `app-lifecycle.ts` covers these new log calls (or add one if missing)

### Task 2: Update `src/main/app-lifecycle.test.ts`

- [x] **2.1** Add mock for `./context-menu-installer` module:
  ```typescript
  vi.mock('./context-menu-installer', () => ({
    register: vi.fn(),
    deregister: vi.fn(),
    isRegistered: vi.fn().mockReturnValue(false),
  }));
  ```
- [x] **2.2** Import mocked functions in test file:
  ```typescript
  import { register as registerContextMenu, deregister as deregisterContextMenu } from './context-menu-installer';
  ```
- [x] **2.3** Write test: `--squirrel-install` calls `registerContextMenu` with `process.execPath`
- [x] **2.4** Write test: `--squirrel-updated` calls `registerContextMenu` with `process.execPath`
- [x] **2.5** Write test: `--squirrel-uninstall` calls `deregisterContextMenu`
- [x] **2.6** Write test: `registerContextMenu` throwing does **not** throw from the Squirrel handler (error is swallowed after logging)
- [x] **2.7** Write test: `deregisterContextMenu` throwing does **not** throw from the Squirrel handler
- [x] **2.8** Write test: Normal startup (no Squirrel flag) — `registerContextMenu` and `deregisterContextMenu` are **not** called
- [x] **2.9** Verify all pre-existing `app-lifecycle.test.ts` tests still pass after the additions

### Task 3: Verify no regression in existing Squirrel handling

- [x] **3.1** Confirm `app.quit()` calls still fire after the new try/catch blocks in each Squirrel branch
- [x] **3.2** Confirm single-instance lock release and tray destroy still occur in the uninstall branch before `app.quit()`
- [x] **3.3** Run `npx vitest run src/main/app-lifecycle.test.ts` — all tests green

## Dev Notes

### Architecture Patterns

Squirrel hooks in Electron run extremely early in the process lifecycle — before `app.on('ready')` fires. The pattern is:

```typescript
// At the very top of app-lifecycle.ts, before any app.on() calls:
if (handleSquirrelEvent()) {
  // Squirrel event was handled; app.quit() will be called inside.
  // Nothing else should execute.
  process.exit(0); // or simply return / fall through after app.quit()
}
```

Each Squirrel branch must call `app.quit()` at the end to terminate the short-lived install/uninstall process.

### Why `process.execPath` Instead of `app.getPath('exe')`

`app.getPath('exe')` is only available after `app.whenReady()` resolves. During Squirrel hooks the app never reaches the ready state before `app.quit()` is called.

`process.execPath` is a Node.js built-in that is available immediately as the absolute path to the current Electron executable — identical to what `app.getPath('exe')` would return at runtime.

```typescript
// Safe in Squirrel hooks:
const exePath = process.execPath; // e.g. "C:\Users\...\QuakeShell.exe"

// NOT safe in Squirrel hooks:
// const exePath = app.getPath('exe'); // throws or returns wrong value before ready
```

### Squirrel Hook Execution Flow

```
squirrel-install
  ├── [EXISTING] Create uninstall shortcut / Start Menu entry
  ├── [EXISTING] app.quit()
  └── [NEW] try { registerContextMenu(process.execPath) } catch { log.error }
      (placed before app.quit())

squirrel-updated
  ├── [EXISTING] Update shortcut / re-create Start Menu entry
  ├── [EXISTING] app.quit()
  └── [NEW] try { registerContextMenu(process.execPath) } catch { log.error }
      (placed before app.quit())

squirrel-uninstall
  ├── [EXISTING] Remove shortcut / tray cleanup / release single-instance lock
  ├── [EXISTING] app.quit()
  └── [NEW] try { deregisterContextMenu() } catch { log.error }
      (placed before app.quit())
```

### Error Handling Philosophy

Registry operations during install/uninstall must be **non-fatal**:

- If `register` fails (e.g. locked registry key, permissions edge-case), the app still installs correctly. The user can manually enable the context menu from Settings.
- If `deregister` fails during uninstall (e.g. key was already manually deleted), the uninstall must still complete. A dangling registry key pointing to a non-existent exe is harmless — Explorer simply ignores it.

This matches the existing pattern in v1 where tray cleanup errors are also logged but non-fatal.

### Key Files to Create/Modify

| File | Action |
|---|---|
| `src/main/app-lifecycle.ts` | UPDATE — import context-menu-installer; add register/deregister calls in Squirrel branches |
| `src/main/app-lifecycle.test.ts` | UPDATE — add mock for context-menu-installer; test all three Squirrel branches |

### Project Structure Notes

- P2-6.1 must be completed before this story; `context-menu-installer.ts` must exist and be importable.
- No new files are created in this story — it is purely additive changes to existing files.
- The IPC handlers from P2-6.1 are independent of this story; Settings GUI wiring is also independent.
- `process.execPath` should be treated as a trusted value from the Node runtime — no sanitization is needed here since it is not user-supplied. The `sanitizeExePath` function inside `context-menu-installer.ts` still validates it as a defence-in-depth measure.

### References

- [Electron Squirrel Startup — electron-squirrel-startup](https://github.com/mongodb-js/electron-squirrel-startup)
- `app-lifecycle.ts` — existing v1 Squirrel handler (read before editing)
- Story P2-6.1 — `context-menu-installer.ts` module (prerequisite)
- `architecture-v2.md` Decision P2-7 — install/uninstall lifecycle integration notes

## Dev Agent Record

### Completion Notes
- Added explicit Squirrel lifecycle handling that registers the context menu on install and update, deregisters it on uninstall, and keeps those registry operations non-fatal.
- Adapted the implementation to the actual codebase shape by moving the early lifecycle hook out of `electron-squirrel-startup` usage in `src/main/index.ts` and delegating the behavior to new helpers in `app-lifecycle.ts`.
- Preserved normal startup behavior and verified the app still boots cleanly with the new lifecycle flow in place.

### Debug Log
- Expanded `app-lifecycle.test.ts` to cover install, update, uninstall, non-fatal error swallowing, and no-op normal startup behavior.
- Re-ran the focused lifecycle suite and the full `npm test` suite after integrating the Squirrel handler changes.
- Confirmed runtime startup remains healthy via `npm start` after the lifecycle refactor.

## File List
- src/main/app-lifecycle.ts
- src/main/app-lifecycle.test.ts
- src/main/index.ts

## Change Log
- 2026-04-06: Integrated context-menu registration and deregistration into the install, update, and uninstall lifecycle flow.
