# Story P2-5.5: Settings — Keyboard Tab

Status: review

## Story
As a user, I want a Keyboard settings tab that displays all QuakeShell shortcuts and lets me remap the toggle hotkey, so that I can resolve conflicts and learn available shortcuts from within the app.

## Acceptance Criteria

- **AC1:** Given the Keyboard settings tab / When rendered / Then the toggle hotkey is shown with a "Remap" button; a reference table lists all Phase 2 shortcuts (Ctrl+T, Ctrl+W, Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+1–9, Ctrl+Shift+D, Ctrl+,)
- **AC2:** Given user clicks "Remap" / Then a "Press new shortcut" recording mode activates: the hotkey display shows "Press keys…", keyboard input is captured, and the next key combination is recorded
- **AC3:** Given user presses a new key combination in recording mode / When recorded / Then `config.hotkey` is updated, the global hotkey is re-registered in the main process, and recording mode exits
- **AC4:** Given the new hotkey conflicts with a known system shortcut / Then a warning is shown inline but the user can still save
- **AC5:** Given user presses Escape during recording mode / Then recording mode exits without saving, restoring the previous hotkey display

## Tasks / Subtasks

### Task 1: Create KeyboardSettings.tsx
- [x] Create `src/renderer/components/Settings/KeyboardSettings.tsx`
- [x] On mount: load current hotkey via `window.quakeshell.config.get('hotkey')`, store in `currentHotkey = signal<string>('')`
- [x] Render two sections: "Global Hotkey" and "Keyboard Reference"
- [x] Export as default component

**Global Hotkey section:**
- [x] Display current hotkey as a styled `<kbd>` element (e.g. `<kbd>Ctrl+\`</kbd>`)
- [x] Add "Remap" button that enters recording mode: sets `isRecording = signal<boolean>(true)`
- [x] When `isRecording` is true:
  - [x] Replace hotkey display with `<span class={styles.recording}>Press keys…</span>`
  - [x] Show "Cancel" button
  - [x] Attach `keydown` listener on document (capture phase, `e.preventDefault()`)
  - [x] Ignore modifier-only keypresses (e.g. pressing Ctrl alone)
  - [x] Format key combination as string (see `formatHotkey` function below)
  - [x] Check for conflicts with `KNOWN_CONFLICTS` list
  - [x] If conflict: set `conflictWarning` signal, do NOT exit recording — let user confirm or cancel
  - [x] If no conflict: save immediately, exit recording
  - [x] Add "Save anyway" button when `conflictWarning` is active
  - [x] Remove `keydown` listener on cancel or save
- [x] After save: call `window.quakeshell.config.set('hotkey', newHotkey)`, then `window.quakeshell.hotkey.reregister(newHotkey)`
- [x] Escape key while recording: cancel recording, restore display

**Keyboard Reference section:**
- [x] Render a two-column table: Action | Shortcut
- [x] Table data defined as `KEYBOARD_SHORTCUTS` const (see below)
- [x] Table rows for all Phase 2 shortcuts

### Task 2: Create KEYBOARD_SHORTCUTS constant
- [x] Define `KEYBOARD_SHORTCUTS` array inside `KeyboardSettings.tsx` (or a co-located constants file):
  ```
  { action: 'Open/Close QuakeShell', shortcut: config.hotkey (dynamic) },
  { action: 'New Tab', shortcut: 'Ctrl+T' },
  { action: 'Close Tab', shortcut: 'Ctrl+W' },
  { action: 'Next Tab', shortcut: 'Ctrl+Tab' },
  { action: 'Previous Tab', shortcut: 'Ctrl+Shift+Tab' },
  { action: 'Switch to Tab 1–9', shortcut: 'Ctrl+1 – Ctrl+9' },
  { action: 'Split Pane', shortcut: 'Ctrl+Shift+D' },
  { action: 'Open Settings', shortcut: 'Ctrl+,' },
  ```

### Task 3: Create formatHotkey helper function
- [x] Create `formatHotkey(e: KeyboardEvent): string | null`
- [x] Returns null if only a modifier key is pressed (key is 'Control', 'Shift', 'Alt', 'Meta')
- [x] Build string: `[Ctrl+][Shift+][Alt+]Key`
- [x] Key display: use `e.key` for most keys; special cases:
  - `Backquote` / `\`` → `` ` ``
  - `Space` → `Space`
  - `Escape` → `Escape` (treat as cancel, return null)
  - Function keys: `F1`–`F12` → pass through as-is
  - Arrow keys: `ArrowUp` → `Up`, etc.
- [x] Example: Ctrl+Shift+F5 → `"Ctrl+Shift+F5"`

### Task 4: Create KNOWN_CONFLICTS list
- [x] Define `KNOWN_CONFLICTS: string[]` — list of hotkey strings that are known to conflict with Windows system shortcuts or common app shortcuts:
  ```
  'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+Z', 'Ctrl+A', 'Ctrl+S',
  'Ctrl+T', 'Ctrl+W', 'Ctrl+Tab', 'Ctrl+F4',
  'Alt+F4', 'Alt+Tab', 'Win+L', 'Win+D',
  'PrintScreen', 'Escape'
  ```
- [x] Note: `'Win+'` prefixed shortcuts cannot be registered via Electron `globalShortcut` anyway — include them for user education

### Task 5: Expose hotkey reregister via preload
- [x] Open `src/preload/index.ts`
- [x] Add `hotkey.reregister(newHotkey: string): Promise<void>` invoking `hotkey:reregister` IPC channel
- [x] Open `src/shared/channels.ts` — add `HOTKEY_REREGISTER = 'hotkey:reregister'`
- [x] Open `src/main/ipc-handlers.ts` — add handler for `hotkey:reregister`:
  - [x] Call `globalShortcut.unregisterAll()` (or unregister only the previous hotkey)
  - [x] Call `globalShortcut.register(newHotkey, toggleWindowCallback)`
  - [x] If `globalShortcut.register` fails (returns false): return `{ success: false, error: 'Failed to register hotkey' }`, log error
  - [x] Update `config.hotkey` in the main process config store (or confirm renderer config.set already propagated it)

### Task 6: Create KeyboardSettings.module.css
- [x] Create `src/renderer/components/Settings/KeyboardSettings.module.css`
- [x] `.sectionTitle`: uppercase label style (same as GeneralSettings, can share via a global `.settings-section-title` class if desired)
- [x] `.hotkeyDisplay`: `display: flex; align-items: center; gap: 12px;`
- [x] `.kbd`: `background: var(--bg-terminal); border: 1px solid var(--border); border-radius: 4px; padding: 3px 8px; font-family: monospace; font-size: 13px; color: var(--fg-primary);`
- [x] `.recording`: `color: var(--accent); font-style: italic; font-size: 13px; padding: 3px 8px; border: 1px dashed var(--accent); border-radius: 4px;`
- [x] `.conflictWarning`: `color: #f4a261; font-size: 12px; margin-top: 6px; padding: 6px 10px; background: rgba(244, 162, 97, 0.1); border-radius: 4px; border: 1px solid rgba(244, 162, 97, 0.3);`
- [x] `.remapBtn`: `background: var(--accent); color: #000; border: none; border-radius: 4px; padding: 5px 12px; cursor: pointer; font-size: 12px;`
- [x] `.cancelBtn`: `background: none; border: 1px solid var(--border); border-radius: 4px; padding: 5px 12px; cursor: pointer; color: var(--fg-primary); font-size: 12px;`
- [x] `.table`: `width: 100%; border-collapse: collapse; margin-top: 8px;`
- [x] `.table th`: `text-align: left; padding: 6px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-dimmed); border-bottom: 1px solid var(--border);`
- [x] `.table td`: `padding: 8px 8px; font-size: 13px; color: var(--fg-primary); border-bottom: 1px solid rgba(var(--border-rgb, 255,255,255), 0.07);`
- [x] `.table td:last-child .kbd`: monospace shortcut cell

### Task 7: Write tests
- [x] Create `src/renderer/components/Settings/KeyboardSettings.test.tsx`
- [x] Mock `window.quakeshell.config.get/set` and `window.quakeshell.hotkey.reregister`
- [x] Test 1: renders current hotkey in `<kbd>` element
- [x] Test 2: all Phase 2 shortcuts visible in reference table
- [x] Test 3: clicking "Remap" enters recording mode (shows "Press keys…" text)
- [x] Test 4: pressing Escape during recording exits without saving
- [x] Test 5: pressing a valid new hotkey calls `config.set('hotkey', ...)` and `hotkey.reregister(...)`
- [x] Test 6: pressing a known-conflict hotkey shows warning but does NOT exit recording mode
- [x] Test 7: "Save anyway" button calls reregister when conflict warning is shown

## Dev Notes

### Architecture Patterns
- **Hotkey re-registration in main process:** The `globalShortcut` API is main-process-only. The renderer cannot directly re-register shortcuts. The flow is: renderer captures key combination → calls `hotkey:reregister` IPC invoke → main process unregisters old hotkey and registers new one → returns success/failure.
- **Recording mode and event capture:** Use `document.addEventListener('keydown', handler, { capture: true })` — capture phase prevents the keydown from propagating to other handlers (including xterm.js, which would otherwise intercept it). Always clean up the listener in cancel/save paths and in the component's cleanup effect.
- **Modifier-only key press filtering:** Check `['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)` before processing. These are not valid standalone hotkeys.
- **globalShortcut.register return value:** In Electron, `globalShortcut.register(accelerator, callback)` returns `boolean` — `true` if registered, `false` if the accelerator is already taken by another application or is invalid. Handle `false` as a registration failure.
- **Existing HotkeyManager:** Epic 1 or 3 may already have a `HotkeyManager` class in `src/main/` that manages hotkey registration. Check for this before implementing raw `globalShortcut` calls in the IPC handler. If it exists, call its re-register method.
- **Electron accelerator format:** Electron's `globalShortcut` uses accelerator strings like `"Ctrl+Shift+F5"` — this matches the format produced by `formatHotkey`. Verify this format works with `globalShortcut.register` directly.
- **config.hotkey set order:** The renderer should call `config.set('hotkey', newHotkey)` BEFORE calling `hotkey.reregister(newHotkey)`. This ensures the config is persisted even if re-registration fails (user can fix by restarting). Alternatively, have the main IPC handler update the config store directly after successful registration.

### Key Files to Create/Modify

| File | Action |
|------|--------|
| `src/renderer/components/Settings/KeyboardSettings.tsx` | CREATE |
| `src/renderer/components/Settings/KeyboardSettings.module.css` | CREATE |
| `src/renderer/components/Settings/KeyboardSettings.test.tsx` | CREATE |
| `src/shared/channels.ts` | MODIFY — add `HOTKEY_REREGISTER` if not from Epic 3 |
| `src/preload/index.ts` | MODIFY — expose `hotkey.reregister` |
| `src/main/ipc-handlers.ts` | MODIFY — add `hotkey:reregister` handler |

### TypeScript Interfaces

```typescript
// formatHotkey helper
function formatHotkey(e: KeyboardEvent): string | null {
  const MODIFIERS = new Set(['Control', 'Shift', 'Alt', 'Meta']);
  if (MODIFIERS.has(e.key)) return null;
  if (e.key === 'Escape') return null; // treat as cancel

  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');

  const KEY_MAP: Record<string, string> = {
    ' ': 'Space',
    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
    '`': '`',
  };
  parts.push(KEY_MAP[e.key] ?? e.key);
  return parts.join('+');
}
```

```typescript
// KNOWN_CONFLICTS
const KNOWN_CONFLICTS = new Set([
  'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+Z', 'Ctrl+Y', 'Ctrl+A', 'Ctrl+S',
  'Ctrl+T', 'Ctrl+W', 'Ctrl+Tab', 'Ctrl+F4', 'Ctrl+,',
  'Alt+F4', 'Alt+Tab',
  'PrintScreen', 'Escape',
]);
```

```typescript
// KeyboardSettings.tsx component skeleton
import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import styles from './KeyboardSettings.module.css';

const currentHotkey = signal<string>('');
const isRecording = signal<boolean>(false);
const pendingHotkey = signal<string>('');
const conflictWarning = signal<string>('');

export default function KeyboardSettings() {
  useEffect(() => {
    window.quakeshell.config.get('hotkey').then(v => { currentHotkey.value = v ?? 'Ctrl+`'; });
  }, []);

  useEffect(() => {
    if (!isRecording.value) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        cancelRecording();
        return;
      }

      const combo = formatHotkey(e);
      if (!combo) return;

      pendingHotkey.value = combo;

      if (KNOWN_CONFLICTS.has(combo)) {
        conflictWarning.value = `"${combo}" may conflict with system or app shortcuts.`;
        // stay in recording mode — user can save anyway or cancel
      } else {
        saveHotkey(combo);
      }
    };

    document.addEventListener('keydown', handler, { capture: true });
    return () => document.removeEventListener('keydown', handler, { capture: true });
  }, [isRecording.value]);

  const cancelRecording = () => {
    isRecording.value = false;
    pendingHotkey.value = '';
    conflictWarning.value = '';
  };

  const saveHotkey = async (combo: string) => {
    await window.quakeshell.config.set('hotkey', combo);
    await window.quakeshell.hotkey.reregister(combo);
    currentHotkey.value = combo;
    isRecording.value = false;
    pendingHotkey.value = '';
    conflictWarning.value = '';
  };

  return (
    <div>
      {/* Global Hotkey section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Global Hotkey</div>
        <div className={styles.hotkeyDisplay}>
          {isRecording.value ? (
            <span className={styles.recording}>
              {pendingHotkey.value || 'Press keys…'}
            </span>
          ) : (
            <kbd className={styles.kbd}>{currentHotkey.value}</kbd>
          )}
          {!isRecording.value && (
            <button className={styles.remapBtn} onClick={() => { isRecording.value = true; }}>Remap</button>
          )}
          {isRecording.value && (
            <button className={styles.cancelBtn} onClick={cancelRecording}>Cancel</button>
          )}
          {conflictWarning.value && (
            <button className={styles.remapBtn} onClick={() => saveHotkey(pendingHotkey.value)}>Save anyway</button>
          )}
        </div>
        {conflictWarning.value && (
          <div className={styles.conflictWarning}>⚠ {conflictWarning.value}</div>
        )}
      </div>

      {/* Keyboard Reference table */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Shortcuts Reference</div>
        <table className={styles.table}>
          <thead>
            <tr><th>Action</th><th>Shortcut</th></tr>
          </thead>
          <tbody>
            {[
              { action: 'Open / Close QuakeShell', shortcut: currentHotkey.value },
              { action: 'New Tab', shortcut: 'Ctrl+T' },
              { action: 'Close Tab', shortcut: 'Ctrl+W' },
              { action: 'Next Tab', shortcut: 'Ctrl+Tab' },
              { action: 'Previous Tab', shortcut: 'Ctrl+Shift+Tab' },
              { action: 'Switch to Tab 1–9', shortcut: 'Ctrl+1–9' },
              { action: 'Split Pane', shortcut: 'Ctrl+Shift+D' },
              { action: 'Open Settings', shortcut: 'Ctrl+,' },
            ].map(({ action, shortcut }) => (
              <tr key={action}>
                <td>{action}</td>
                <td><kbd className={styles.kbd}>{shortcut}</kbd></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### Project Structure Notes
- Check if `HotkeyManager` exists in `src/main/` before writing raw `globalShortcut` calls. If it does, add a `reregister(accelerator: string): boolean` method to it.
- The `hotkey:reregister` IPC channel may already exist from Epic 3 (Hotkey Remapping story P2-3, if implemented). Check `src/shared/channels.ts` and `src/main/ipc-handlers.ts` before adding it.
- The reference table shortcut values are static except for the toggle hotkey (which comes from `currentHotkey` signal). All others are hardcoded Phase 2 values.
- Recording mode must attach the event listener in a `useEffect` that re-runs when `isRecording` changes — not on mount — so the listener is only active during recording. Clean up is critical to prevent ghost listeners.

### References
- `src/shared/channels.ts` — existing IPC channels from Epic 1 and Epic 3
- `src/main/ipc-handlers.ts` — where global hotkey re-registration is handled
- `docs/planning-artifacts/epics-v2.md` — Epic 3 Hotkey Remapping, Phase 2 shortcut list
- Story P2-5.1 — SettingsPanel shell and tab routing
- Story P2-5.2 — SettingsRow helper (use for hotkey row if desired)

## Dev Agent Record

### Completion Notes
- Implemented the Keyboard tab with current-hotkey display, remap recording mode, conflict warnings, save-anyway handling, and the Phase 2 shortcut reference table.
- Added renderer-to-main hotkey re-registration support so remaps are persisted and applied through the existing global shortcut plumbing.
- Kept recording mode isolated to active remap sessions by attaching and removing capture-phase listeners only while recording.

### Debug Log
- Added renderer tests covering initial hotkey rendering, table content, recording mode, Escape cancel, successful remap, conflict warning flow, and save-anyway behavior.
- Verified the main-process hotkey re-registration path returns structured failures instead of silently dropping bad registrations.
- Verified the full automated suite passes with `npm test` (42 files, 503 tests).

## File List
- src/renderer/components/Settings/KeyboardSettings.tsx
- src/renderer/components/Settings/KeyboardSettings.module.css
- src/renderer/components/Settings/KeyboardSettings.test.tsx
- src/preload/index.ts
- src/shared/channels.ts
- src/shared/ipc-types.ts
- src/main/ipc-handlers.ts

## Change Log
- 2026-04-05: Implemented the Keyboard settings tab, hotkey capture/remap flow, shortcut reference table, and remap tests.
