# Story P2-5.6: Settings — Distribution Tab

Status: review

## Story
As a user, I want a Distribution settings tab with a context menu registration toggle, so that I can enable or disable "Open QuakeShell here" in Explorer without reinstalling.

## Acceptance Criteria

- **AC1:** Given the Distribution settings tab / When rendered / Then it shows the context menu registration status ("Registered" or "Not registered") and a Register / Deregister button matching the current status
- **AC2:** Given the context menu entry is not registered / When user clicks "Register" / Then `app:register-context-menu` IPC is called, registry entries are written, and the status updates to "Registered" with the button changing to "Deregister"
- **AC3:** Given the context menu entry is registered / When user clicks "Deregister" / Then `app:deregister-context-menu` IPC is called, registry entries are removed, and the status updates to "Not registered" with the button changing to "Register"
- **AC4:** Given the registration or deregistration fails / When error is caught / Then electron-log captures it; the UI shows an inline error message; the status does not falsely update
- **AC5:** Given the IPC call is in-flight / When button is clicked again / Then the button is disabled and shows a spinner (prevents double-click during async operation)

## Tasks / Subtasks

### Task 1: Confirm Epic 6 dependency
- [x] Check `src/shared/channels.ts` for the following channels (added by Epic 6 Story 6.1):
  - `app:register-context-menu`
  - `app:deregister-context-menu`
  - `app:context-menu-status`
- [x] Check `src/preload/index.ts` for `window.quakeshell.app.registerContextMenu()`, `deregisterContextMenu()`, `getContextMenuStatus()`
- [x] **If Epic 6 is not yet done:** stub the IPC channels and preload APIs with placeholder implementations that return `{ success: false, error: 'Not implemented — Epic 6 pending' }`. The UI will show a "Feature not yet available" message in this case.

### Task 2: Add IPC channels to channels.ts (if not from Epic 6)
- [x] Open `src/shared/channels.ts`
- [x] Add if missing: `APP_REGISTER_CONTEXT_MENU = 'app:register-context-menu'`
- [x] Add if missing: `APP_DEREGISTER_CONTEXT_MENU = 'app:deregister-context-menu'`
- [x] Add if missing: `APP_CONTEXT_MENU_STATUS = 'app:context-menu-status'`

### Task 3: Add preload API bridges (if not from Epic 6)
- [x] Open `src/preload/index.ts`
- [x] Confirm or add under `window.quakeshell.app`:
  ```typescript
  registerContextMenu: (): Promise<ContextMenuResult> =>
    ipcRenderer.invoke(CHANNELS.APP_REGISTER_CONTEXT_MENU),
  deregisterContextMenu: (): Promise<ContextMenuResult> =>
    ipcRenderer.invoke(CHANNELS.APP_DEREGISTER_CONTEXT_MENU),
  getContextMenuStatus: (): Promise<ContextMenuStatus> =>
    ipcRenderer.invoke(CHANNELS.APP_CONTEXT_MENU_STATUS),
  ```

### Task 4: Create DistributionSettings.tsx
- [x] Create `src/renderer/components/Settings/DistributionSettings.tsx`
- [x] On mount: call `window.quakeshell.app.getContextMenuStatus()` to get current registration state
- [x] Store in `isRegistered = signal<boolean | null>(null)` (null = loading)
- [x] Store `isLoading = signal<boolean>(false)`, `error = signal<string>('')`
- [x] Loading state: show spinner/skeleton while initial status is fetching
- [x] Render context menu row using `<SettingsRow>` helper
- [x] Show status badge: `<span className={isRegistered.value ? styles.badgeRegistered : styles.badgeUnregistered}>{ isRegistered.value ? 'Registered' : 'Not registered' }</span>`
- [x] Show action button:
  - [x] If `isLoading.value`: show spinner button (disabled)
  - [x] If `isRegistered.value === true`: show "Deregister" button (calls `handleDeregister`)
  - [x] If `isRegistered.value === false`: show "Register" button (calls `handleRegister`)
- [x] `handleRegister`: set `isLoading = true`, clear `error`, call `app.registerContextMenu()`, on success set `isRegistered = true`, on failure set `error = result.error`, always set `isLoading = false`
- [x] `handleDeregister`: set `isLoading = true`, clear `error`, call `app.deregisterContextMenu()`, on success set `isRegistered = false`, on failure set `error = result.error`, always set `isLoading = false`
- [x] If `error` signal is non-empty: render `<div className={styles.error}>{error.value}</div>` below the row
- [x] Render an info section explaining what the context menu entry does (see content below)
- [x] Export as default component

**Info section content:**
> When registered, right-clicking any folder in Windows Explorer will show "Open QuakeShell here", launching a terminal in that directory.
> Registration requires writing to the Windows Registry at `HKCU\Software\Classes\Directory\shell\QuakeShell`.

### Task 5: Create DistributionSettings.module.css
- [x] Create `src/renderer/components/Settings/DistributionSettings.module.css`
- [x] `.statusRow`: `display: flex; align-items: center; gap: 12px; margin-bottom: 8px;`
- [x] `.badgeRegistered`: `background: rgba(var(--accent-rgb, 100,200,100), 0.15); color: var(--accent); border: 1px solid var(--accent); border-radius: 12px; padding: 2px 10px; font-size: 11px; font-weight: 600;`
- [x] `.badgeUnregistered`: `background: rgba(255,255,255,0.05); color: var(--fg-dimmed); border: 1px solid var(--border); border-radius: 12px; padding: 2px 10px; font-size: 11px;`
- [x] `.actionBtn`: `background: var(--accent); color: #000; border: none; border-radius: 4px; padding: 6px 14px; font-size: 12px; cursor: pointer; min-width: 100px; display: flex; align-items: center; justify-content: center; gap: 6px;`
- [x] `.actionBtn:disabled`: `opacity: 0.5; cursor: not-allowed;`
- [x] `.actionBtnDeregister`: `background: none; border: 1px solid var(--border); color: var(--fg-primary);` (extend `.actionBtn`)
- [x] `.spinner`: `width: 12px; height: 12px; border: 2px solid transparent; border-top-color: currentColor; border-radius: 50%; animation: spin 0.6s linear infinite;`
- [x] `@keyframes spin { to { transform: rotate(360deg); } }`
- [x] `.error`: `color: #ff6b6b; font-size: 12px; padding: 8px 12px; background: rgba(255,107,107,0.1); border: 1px solid rgba(255,107,107,0.3); border-radius: 4px; margin-top: 8px;`
- [x] `.infoSection`: `margin-top: 24px; padding: 16px; background: var(--bg-terminal); border-radius: 6px; border: 1px solid var(--border);`
- [x] `.infoTitle`: `font-size: 12px; font-weight: 600; color: var(--fg-dimmed); margin-bottom: 8px;`
- [x] `.infoText`: `font-size: 12px; color: var(--fg-dimmed); line-height: 1.5;`
- [x] `.registryPath`: `font-family: monospace; font-size: 11px; background: var(--bg-chrome); padding: 2px 6px; border-radius: 3px; color: var(--fg-primary);`

### Task 6: Write tests
- [x] Create `src/renderer/components/Settings/DistributionSettings.test.tsx`
- [x] Mock `window.quakeshell.app.registerContextMenu`, `deregisterContextMenu`, `getContextMenuStatus`
- [x] Test 1: shows loading skeleton while status is fetching
- [x] Test 2: shows "Not registered" badge and "Register" button when status = false
- [x] Test 3: shows "Registered" badge and "Deregister" button when status = true
- [x] Test 4: clicking "Register" calls `registerContextMenu()` and updates status to registered on success
- [x] Test 5: clicking "Deregister" calls `deregisterContextMenu()` and updates status to not registered on success
- [x] Test 6: button is disabled while IPC is in-flight (spinner shown)
- [x] Test 7: error message shown when IPC returns `{ success: false, error: '...' }` and status does NOT update

## Dev Notes

### Architecture Patterns
- **Epic 6 dependency:** This tab has a hard dependency on Epic 6 (Story 6.1: Context Menu Installer). The IPC channels `app:register-context-menu`, `app:deregister-context-menu`, and `app:context-menu-status` are implemented in Epic 6. If Epic 6 is not yet complete, this tab will still render but the action buttons will show an "unavailable" state rather than crashing.
- **Loading state matters:** The initial status fetch is async. In the time between mount and the IPC response, show a loading state (skeleton or spinner). Do not render the action button until status is known to avoid accidental clicks.
- **Error handling pattern:** All three async operations (status check, register, deregister) must wrap the IPC call in try/catch. Return type from preload should be `{ success: boolean; error?: string }`. On `success: false`, set the error signal — do NOT update `isRegistered`.
- **Double-submission prevention:** Set `isLoading = true` before the IPC invoke and reset it `finally`. The action button `disabled={isLoading.value}` ensures no second click can fire.
- **Registry path:** `HKCU\Software\Classes\Directory\shell\QuakeShell\command` — this is a per-user registry path requiring no elevation. The main process writes it using Node.js `child_process.exec` on `reg.exe` or via the `winreg` package. This is Epic 6's responsibility; this story only surfaces the status in the UI.
- **electron-log:** Error logging for failed registration/deregistration belongs in the main process IPC handler (Epic 6). The renderer should only log that it received an error response (use `electronLog.scope('settings-distribution')` if the renderer needs to log at all).
- **No config key for context menu status:** The registration state is NOT stored in `electron-store` config. It is determined live by checking if the registry key exists. This is why `app:context-menu-status` is a runtime check, not a `config.get` call.

### Key Files to Create/Modify

| File | Action |
|------|--------|
| `src/renderer/components/Settings/DistributionSettings.tsx` | CREATE |
| `src/renderer/components/Settings/DistributionSettings.module.css` | CREATE |
| `src/renderer/components/Settings/DistributionSettings.test.tsx` | CREATE |
| `src/shared/channels.ts` | MODIFY — add context menu channels (if not from Epic 6) |
| `src/preload/index.ts` | MODIFY — confirm/add `app.registerContextMenu` etc. (if not from Epic 6) |

### TypeScript Interfaces

```typescript
// src/shared/ipc-types.ts additions
export interface ContextMenuResult {
  success: boolean;
  error?: string;
}

export interface ContextMenuStatus {
  isRegistered: boolean;
}
```

```typescript
// DistributionSettings.tsx component
import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import SettingsRow from './SettingsRow';
import styles from './DistributionSettings.module.css';

const isRegistered = signal<boolean | null>(null); // null = loading
const isLoading = signal<boolean>(false);
const error = signal<string>('');

export default function DistributionSettings() {
  useEffect(() => {
    (async () => {
      try {
        const status = await window.quakeshell.app.getContextMenuStatus();
        isRegistered.value = status.isRegistered;
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to check registration status';
        isRegistered.value = false;
      }
    })();
  }, []);

  const handleRegister = async () => {
    isLoading.value = true;
    error.value = '';
    try {
      const result = await window.quakeshell.app.registerContextMenu();
      if (result.success) {
        isRegistered.value = true;
      } else {
        error.value = result.error ?? 'Registration failed';
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unexpected error during registration';
    } finally {
      isLoading.value = false;
    }
  };

  const handleDeregister = async () => {
    isLoading.value = true;
    error.value = '';
    try {
      const result = await window.quakeshell.app.deregisterContextMenu();
      if (result.success) {
        isRegistered.value = false;
      } else {
        error.value = result.error ?? 'Deregistration failed';
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unexpected error during deregistration';
    } finally {
      isLoading.value = false;
    }
  };

  const renderButton = () => {
    if (isRegistered.value === null) return null; // still loading initial status

    if (isLoading.value) {
      return (
        <button className={styles.actionBtn} disabled>
          <span className={styles.spinner} aria-hidden="true" />
          {isRegistered.value ? 'Deregistering…' : 'Registering…'}
        </button>
      );
    }

    if (isRegistered.value) {
      return (
        <button
          className={`${styles.actionBtn} ${styles.actionBtnDeregister}`}
          onClick={handleDeregister}
        >
          Deregister
        </button>
      );
    }

    return (
      <button className={styles.actionBtn} onClick={handleRegister}>
        Register
      </button>
    );
  };

  return (
    <div>
      <SettingsRow
        label="Explorer Context Menu"
        description='"Open QuakeShell here" entry in Windows Explorer right-click menu'
      >
        <div className={styles.statusRow}>
          {isRegistered.value === null ? (
            <span className={styles.badgeUnregistered}>Checking…</span>
          ) : (
            <span className={isRegistered.value ? styles.badgeRegistered : styles.badgeUnregistered}>
              {isRegistered.value ? 'Registered' : 'Not registered'}
            </span>
          )}
          {renderButton()}
        </div>
        {error.value && <div className={styles.error}>{error.value}</div>}
      </SettingsRow>

      <div className={styles.infoSection}>
        <div className={styles.infoTitle}>About Context Menu Registration</div>
        <p className={styles.infoText}>
          When registered, right-clicking any folder in Windows Explorer shows{' '}
          <strong>"Open QuakeShell here"</strong>, launching a terminal in that directory.
        </p>
        <p className={styles.infoText}>
          No administrator privileges required. Registry path:{' '}
          <code className={styles.registryPath}>
            HKCU\Software\Classes\Directory\shell\QuakeShell
          </code>
        </p>
      </div>
    </div>
  );
}
```

### Preload API Extension

```typescript
// To add in src/preload/index.ts under window.quakeshell.app (confirm with Epic 6):
app: {
  // ... existing app APIs (if any)
  registerContextMenu: (): Promise<ContextMenuResult> =>
    ipcRenderer.invoke(CHANNELS.APP_REGISTER_CONTEXT_MENU),
  deregisterContextMenu: (): Promise<ContextMenuResult> =>
    ipcRenderer.invoke(CHANNELS.APP_DEREGISTER_CONTEXT_MENU),
  getContextMenuStatus: (): Promise<ContextMenuStatus> =>
    ipcRenderer.invoke(CHANNELS.APP_CONTEXT_MENU_STATUS),
},
```

### Project Structure Notes
- This is the only Settings tab with a hard runtime dependency on another Epic (Epic 6). It is safe to implement the renderer component (this story) before Epic 6 completes — use the stub strategy described in Task 1 to make it testable.
- The stub strategy: if `getContextMenuStatus` is not yet implemented in main, have the preload stub return `{ isRegistered: false }` gracefully. This allows the UI to render in "not registered" state without crashing.
- `SettingsRow` must be implemented (from P2-5.2) before this story. It is used for the context menu row layout.
- This tab has intentionally minimal content — context menu registration is a one-time action for most users. The info section provides enough context for the user to understand what they're doing.

### References
- `src/shared/channels.ts` — all IPC channel constants
- `src/preload/index.ts` — contextBridge preload API
- Story P2-5.1 — SettingsPanel shell and tab routing
- Story P2-5.2 — SettingsRow helper component
- Epic 6 Story 6.1 — Context Menu Installer (implements the main-process side of these IPC channels)
- `docs/planning-artifacts/epics-v2.md` — Epic 6 distribution requirements

## Dev Agent Record

### Completion Notes
- Implemented the Distribution tab UI for context-menu status, register/deregister actions, in-flight protection, and inline failure messaging.
- Added the app-level preload and IPC surface needed by the tab and provided graceful placeholder behavior while Epic 6 registry installers remain pending.
- Kept the renderer honest about dependency state: unavailable or failed operations do not falsely flip the displayed registration status.

### Debug Log
- Added renderer tests covering loading state, registered/unregistered actions, in-flight disabling, and failure handling.
- Stubbed the context-menu APIs so the tab remains testable and non-crashing before Epic 6 delivers the registry writer implementation.
- Verified the full automated suite passes with `npm test` (42 files, 503 tests).

## File List
- src/renderer/components/Settings/DistributionSettings.tsx
- src/renderer/components/Settings/DistributionSettings.module.css
- src/renderer/components/Settings/DistributionSettings.test.tsx
- src/preload/index.ts
- src/shared/channels.ts
- src/shared/ipc-types.ts
- src/main/ipc-handlers.ts

## Change Log
- 2026-04-05: Implemented the Distribution settings tab with context-menu status UI, async action handling, and Epic 6-safe placeholder behavior.
