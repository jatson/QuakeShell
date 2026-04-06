# Story P2-5.2: Settings — General Tab

Status: review

## Story
As a user, I want a General settings tab with controls for shell, hotkey, focus-fade, autostart, window dimensions, and monitor selection, so that I can configure all core behaviours from the GUI.

## Acceptance Criteria

- **AC1:** Given the General settings tab / When rendered / Then it shows: default shell dropdown (PowerShell / WSL / cmd / Git Bash / Custom path), hotkey display with remap instructions, focus-fade toggle, autostart toggle, terminal height slider (10%–90%), terminal width slider (20%–100%), monitor dropdown (Active Monitor / Primary Monitor / Monitor 1…N)
- **AC2:** Given user changes the default shell dropdown / When committed / Then `config.defaultShell` is updated via `quakeshell.config.set`; existing open tabs keep their shell; new tabs use the new default
- **AC3:** Given user adjusts the terminal height slider / When released (`onPointerUp` / `onChange` on release) / Then `config.window.heightPercent` is updated and the window resizes immediately
- **AC4:** Given user adjusts the terminal width slider / When released / Then `config.window.widthPercent` is updated and the window width adjusts immediately
- **AC5:** Given user selects a monitor in the monitor dropdown / When saved / Then `config.window.monitor` is updated and the terminal appears on the selected monitor on next show
- **AC6:** Given running on Windows 11 22H2+ (build ≥ 22621) / When the General tab is rendered / Then an "Acrylic blur" toggle is visible; on all other OS versions, this toggle is hidden
- **AC7:** Given user enables the acrylic blur toggle / When the setting is saved / Then `config.acrylicBlur` becomes `true` and `window-manager.ts` applies `backgroundMaterial: 'acrylic'`; if the API call fails, electron-log captures the error and the toggle reverts to off

## Tasks / Subtasks

### Task 1: Expose platform APIs via preload
- [x] Open `src/preload/index.ts`
- [x] Add `platform.isAcrylicSupported(): Promise<boolean>` — invokes new IPC channel `platform:is-acrylic-supported`
- [x] Add `display.getAll(): Promise<DisplayInfo[]>` — invokes new IPC channel `display:get-all`
- [x] Expose both under `window.quakeshell.platform` and `window.quakeshell.display` respectively

### Task 2: Add IPC channels for platform and display
- [x] Open `src/shared/channels.ts`
- [x] Add `PLATFORM_IS_ACRYLIC_SUPPORTED = 'platform:is-acrylic-supported'`
- [x] Add `DISPLAY_GET_ALL = 'display:get-all'`
- [x] Open `src/main/ipc-handlers.ts`
- [x] Add handler for `platform:is-acrylic-supported`: use `require('os').release()` to parse build number; return `buildNumber >= 22621`
- [x] Add handler for `display:get-all`: return `screen.getAllDisplays().map(d => ({ id: d.id, label: d.label || 'Monitor', bounds: d.bounds, isPrimary: d.id === screen.getPrimaryDisplay().id }))`

### Task 3: Update window-manager.ts for acrylicBlur
- [x] Open `src/main/window-manager.ts`
- [x] Add a handler or export function `applyAcrylicBlur(enabled: boolean): void`
- [x] If `enabled`: call `win.setBackgroundMaterial('acrylic')` — wrap in try/catch; on error, log with electron-log and return false
- [x] If `!enabled`: call `win.setBackgroundMaterial('none')`
- [x] Wire to config change: when `config.acrylicBlur` changes (listen to config-store change event), call `applyAcrylicBlur`
- [x] Expose via IPC: add `window:set-acrylic-blur` channel that accepts `{ enabled: boolean }` — this lets the renderer trigger it directly after setting config

### Task 4: Create shared DisplayInfo type
- [x] Open or create `src/shared/ipc-types.ts`
- [x] Add `export interface DisplayInfo { id: number; label: string; bounds: { x: number; y: number; width: number; height: number }; isPrimary: boolean; }`

### Task 5: Create GeneralSettings.tsx component
- [x] Create `src/renderer/components/Settings/GeneralSettings.tsx`
- [x] On mount: call `window.quakeshell.config.get('defaultShell')`, `config.get('window')`, `config.get('hotkey')`, `config.get('focusFade')`, `config.get('autostart')`, `config.get('acrylicBlur')` — load into local signals
- [x] On mount: call `window.quakeshell.display.getAll()` to populate monitor list
- [x] On mount: call `window.quakeshell.platform.isAcrylicSupported()` to determine if acrylic toggle is visible
- [x] Render sections with `<SettingsRow label="...">` pattern (see interface below)
- [x] **Default Shell section:** `<select>` with options: PowerShell, WSL, cmd, Git Bash, Custom. When "Custom" selected, show a text input for the custom path. On change: `config.set('defaultShell', value)`
- [x] **Global Hotkey section:** display current hotkey text (e.g. "Ctrl+`"), add link "Change in Keyboard tab" that calls `openSettings('keyboard')`
- [x] **Focus Fade section:** `<Toggle>` bound to `config.focusFade`. On change: `config.set('focusFade', value)`
- [x] **Autostart section:** `<Toggle>` bound to `config.autostart`. On change: `config.set('autostart', value)`
- [x] **Terminal Height section:** `<input type="range" min="10" max="90">` with numeric readout. On `pointerUp`/`change` (not `input`): `config.set('window.heightPercent', value)`
- [x] **Terminal Width section:** `<input type="range" min="20" max="100">` with numeric readout. On release: `config.set('window.widthPercent', value)`
- [x] **Monitor section:** `<select>` populated from `display.getAll()` results. Options: "Active Monitor", "Primary Monitor", then `Monitor 1`, `Monitor 2`… On change: `config.set('window.monitor', value)`
- [x] **Acrylic Blur section** (conditional): only render when `isAcrylicSupported` is true. `<Toggle>` bound to `config.acrylicBlur`. On change: `config.set('acrylicBlur', value)`, then call `window.quakeshell.window.setAcrylicBlur(value)`. On error from IPC: revert toggle, show inline error
- [x] Export as default component

### Task 6: Create SettingsRow helper component
- [x] Create `src/renderer/components/Settings/SettingsRow.tsx`
- [x] Props: `{ label: string; description?: string; children: ComponentChildren }`
- [x] Renders `<div class="row"><label>...<span class="desc">...</span></label><div class="control">{children}</div></div>`
- [x] Create `src/renderer/components/Settings/SettingsRow.module.css` with grid layout (label left, control right)

### Task 7: Create Toggle helper component
- [x] Create `src/renderer/components/Settings/Toggle.tsx`
- [x] Props: `{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }`
- [x] Renders a CSS toggle switch (not a native checkbox) styled with design tokens
- [x] Create `src/renderer/components/Settings/Toggle.module.css`

### Task 8: Create GeneralSettings.module.css
- [x] Create `src/renderer/components/Settings/GeneralSettings.module.css`
- [x] `.section`: `margin-bottom: 24px;`
- [x] `.sectionTitle`: `font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--fg-dimmed); margin-bottom: 8px;`
- [x] `.select`: standard select styled with `background: var(--bg-terminal); color: var(--fg-primary); border: 1px solid var(--border); border-radius: 4px; padding: 6px 8px;`
- [x] `.slider`: `width: 100%; accent-color: var(--accent);`
- [x] `.sliderReadout`: `font-size: 12px; color: var(--fg-dimmed); min-width: 36px; text-align: right;`
- [x] `.error`: `color: #ff6b6b; font-size: 12px; margin-top: 4px;`

### Task 9: Write tests
- [x] Create `src/renderer/components/Settings/GeneralSettings.test.tsx`
- [x] Mock `window.quakeshell.config.get/set` and `window.quakeshell.display.getAll` and `window.quakeshell.platform.isAcrylicSupported`
- [x] Test 1: renders all expected sections
- [x] Test 2: changing shell dropdown calls `config.set('defaultShell', value)`
- [x] Test 3: toggling focusFade calls `config.set('focusFade', true/false)`
- [x] Test 4: acrylic toggle is absent when `isAcrylicSupported = false`
- [x] Test 5: acrylic toggle is present when `isAcrylicSupported = true`
- [x] Test 6: acrylic toggle reverts on IPC error

## Dev Notes

### Architecture Patterns
- **No new IPC for settings reads/writes:** All config values flow through the existing `quakeshell.config.get` / `quakeshell.config.set` channels from Epic 1. NEW IPC added here is only for platform info (`platform:is-acrylic-supported`) and display enumeration (`display:get-all`) — not for config values.
- **Slider update strategy:** Use `onPointerUp` + `onChange` events to update config only on release, not on every pixel drag. This avoids flooding the main process with IPC calls during drag. Show a live readout label that updates on every `onInput` event for responsiveness.
- **Acrylic blur error handling:** The `BrowserWindow.setBackgroundMaterial` API can throw if the Windows version is incorrect. Always wrap in try/catch in main process. Return `{ success: boolean; error?: string }` from the IPC handler. In the component, if `success === false`: revert `acrylicBlur` signal to `false`, call `config.set('acrylicBlur', false)`, show inline error text.
- **Monitor values:** `config.window.monitor` should accept `'active'`, `'primary'`, or a numeric display `id`. The `display.getAll()` IPC returns `DisplayInfo[]`. Build the dropdown options: `[{ value: 'active', label: 'Active Monitor' }, { value: 'primary', label: 'Primary Monitor' }, ...displays.map(d => ({ value: d.id, label: d.label || 'Monitor ' + i }))]`.
- **electron-log scoped logger:** In `window-manager.ts`, use `electronLog.scope('window-manager')` for all log calls in `applyAcrylicBlur`.

### Key Files to Create/Modify

| File | Action |
|------|--------|
| `src/renderer/components/Settings/GeneralSettings.tsx` | CREATE |
| `src/renderer/components/Settings/GeneralSettings.module.css` | CREATE |
| `src/renderer/components/Settings/SettingsRow.tsx` | CREATE |
| `src/renderer/components/Settings/SettingsRow.module.css` | CREATE |
| `src/renderer/components/Settings/Toggle.tsx` | CREATE |
| `src/renderer/components/Settings/Toggle.module.css` | CREATE |
| `src/renderer/components/Settings/GeneralSettings.test.tsx` | CREATE |
| `src/preload/index.ts` | MODIFY — add `platform` and `display` APIs |
| `src/main/ipc-handlers.ts` | MODIFY — add platform and display handlers |
| `src/main/window-manager.ts` | MODIFY — add `applyAcrylicBlur` |
| `src/shared/channels.ts` | MODIFY — add new channel constants |
| `src/shared/ipc-types.ts` | MODIFY — add `DisplayInfo` interface |

### TypeScript Interfaces

```typescript
// src/shared/ipc-types.ts additions
export interface DisplayInfo {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  isPrimary: boolean;
}

export interface AcrylicBlurResult {
  success: boolean;
  error?: string;
}
```

```typescript
// Preload API additions in src/preload/index.ts
// (add to the contextBridge.exposeInMainWorld payload)
platform: {
  isAcrylicSupported: (): Promise<boolean> =>
    ipcRenderer.invoke(CHANNELS.PLATFORM_IS_ACRYLIC_SUPPORTED),
},
display: {
  getAll: (): Promise<DisplayInfo[]> =>
    ipcRenderer.invoke(CHANNELS.DISPLAY_GET_ALL),
},
window: {
  // existing window APIs...
  setAcrylicBlur: (enabled: boolean): Promise<AcrylicBlurResult> =>
    ipcRenderer.invoke(CHANNELS.WINDOW_SET_ACRYLIC_BLUR, { enabled }),
},
```

```typescript
// Main IPC handler for platform:is-acrylic-supported
ipcMain.handle(CHANNELS.PLATFORM_IS_ACRYLIC_SUPPORTED, () => {
  const release = require('os').release(); // e.g. "10.0.22621"
  const parts = release.split('.');
  const build = parseInt(parts[2] ?? '0', 10);
  return build >= 22621;
});

// Main IPC handler for display:get-all
ipcMain.handle(CHANNELS.DISPLAY_GET_ALL, () => {
  const { screen } = require('electron');
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: d.label || `Monitor ${i + 1}`,
    bounds: d.bounds,
    isPrimary: d.id === primary.id,
  }));
});
```

```typescript
// GeneralSettings.tsx local state pattern
import { signal } from '@preact/signals';
import type { DisplayInfo } from '../../../shared/ipc-types';

const defaultShell = signal<string>('');
const focusFade = signal<boolean>(false);
const autostart = signal<boolean>(false);
const heightPercent = signal<number>(40);
const widthPercent = signal<number>(100);
const monitor = signal<string>('active');
const acrylicBlur = signal<boolean>(false);
const isAcrylicSupported = signal<boolean>(false);
const displays = signal<DisplayInfo[]>([]);
const acrylicError = signal<string>('');
```

```typescript
// Toggle.tsx
interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
}

export default function Toggle({ checked, onChange, disabled, id }: ToggleProps) {
  return (
    <label className={styles.toggle}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        id={id}
        onChange={e => onChange((e.target as HTMLInputElement).checked)}
        className={styles.input}
      />
      <span className={styles.track}>
        <span className={styles.thumb} />
      </span>
    </label>
  );
}
```

### CSS Toggle Specification

```css
/* Toggle.module.css */
.toggle { display: inline-flex; align-items: center; cursor: pointer; }
.input { position: absolute; opacity: 0; width: 0; height: 0; }
.track {
  width: 36px; height: 20px;
  background: var(--fg-dimmed);
  border-radius: 10px;
  position: relative;
  transition: background 0.2s;
}
.input:checked + .track { background: var(--accent); }
.thumb {
  position: absolute;
  top: 2px; left: 2px;
  width: 16px; height: 16px;
  background: white;
  border-radius: 50%;
  transition: left 0.2s;
}
.input:checked + .track .thumb { left: 18px; }
.input:disabled + .track { opacity: 0.4; cursor: not-allowed; }
```

### Project Structure Notes
- `SettingsRow` and `Toggle` are shared helper components used by ALL Settings tab stories (P2-5.2 through P2-5.6). Create them in this story.
- The `os` module is **not available in the renderer process**. The `platform:is-acrylic-supported` IPC call goes main-process-side where `os` is available.
- Windows build number is the third segment of `os.release()`. Parse carefully: `'10.0.22621'.split('.')` → `['10', '0', '22621']`.
- `BrowserWindow.setBackgroundMaterial` requires Electron 20+ and Windows 11. Guard the call: check if the method exists before calling (`typeof win.setBackgroundMaterial === 'function'`).

### References
- `src/shared/config-schema.ts` — `defaultShell`, `window.heightPercent`, `window.widthPercent`, `window.monitor`, `focusFade`, `autostart`, `acrylicBlur` key definitions
- `src/main/window-manager.ts` — existing window resize logic to hook into
- `docs/planning-artifacts/architecture-v2.md` Decision P2-6 — acrylic blur implementation decision
- Story P2-5.1 — `SettingsPanel.tsx` shell (must be complete first, or develop in parallel with stub tab content)

## Dev Agent Record

### Completion Notes
- Implemented the General tab UI for shell selection, hotkey visibility, focus fade, autostart, sizing controls, monitor selection, and acrylic blur support.
- Added shared `SettingsRow` and `Toggle` helpers that are reused by the rest of the settings tabs.
- Extended preload, shared IPC types, and main-process handlers to expose display enumeration, acrylic capability checks, and acrylic material application.

### Debug Log
- Added renderer tests for shell changes, toggle changes, acrylic visibility, and acrylic failure reversion.
- Hardened the window-manager acrylic and display logic so it tolerates existing test doubles and legacy config values.
- Verified the full automated suite passes with `npm test` (42 files, 503 tests).

## File List
- src/renderer/components/Settings/GeneralSettings.tsx
- src/renderer/components/Settings/GeneralSettings.module.css
- src/renderer/components/Settings/GeneralSettings.test.tsx
- src/renderer/components/Settings/SettingsRow.tsx
- src/renderer/components/Settings/SettingsRow.module.css
- src/renderer/components/Settings/Toggle.tsx
- src/renderer/components/Settings/Toggle.module.css
- src/preload/index.ts
- src/shared/channels.ts
- src/shared/ipc-types.ts
- src/main/ipc-handlers.ts
- src/main/window-manager.ts

## Change Log
- 2026-04-05: Implemented the General settings tab, shared settings form helpers, and acrylic/display platform support wiring.
