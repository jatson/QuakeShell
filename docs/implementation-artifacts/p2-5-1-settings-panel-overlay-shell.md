# Story P2-5.1: Settings Panel Overlay Shell

Status: review

## Story
As a user, I want to open an in-app settings overlay with Ctrl+, that I can dismiss with Escape, so that I can access all settings without leaving the terminal or opening a separate window.

## Acceptance Criteria

- **AC1:** Given the terminal is visible / When user presses Ctrl+, / Then the Settings overlay renders above the active terminal within 100ms; the running terminal session remains alive behind it
- **AC2:** Given the settings button (⚙) in the tab bar / When clicked / Then the Settings overlay opens (same result as Ctrl+,)
- **AC3:** Given the Settings overlay is open / When user presses Escape / Then the overlay closes and focus returns to the active terminal xterm instance
- **AC4:** Given the Settings overlay / When rendered / Then it contains tab navigation: General | Appearance | Themes | Keyboard | Distribution; max width 600px, centered in terminal area; backdrop dim behind it
- **AC5:** Given a settings change made in the overlay / When saved / Then it calls the existing `quakeshell.config.set` IPC channel — no new IPC needed; changes hot-reload immediately
- **AC6:** Given the "Edit Config File" button in any Settings tab / When clicked / Then the config JSON file opens in the user's default editor (same as tray "Edit Settings" behaviour)

## Tasks / Subtasks

### Task 1: Create settings-store.ts (renderer state)
- [x] Create `src/renderer/state/settings-store.ts`
- [x] Export `isSettingsOpen = signal<boolean>(false)`
- [x] Export `activeSettingsTab = signal<SettingsTab>('general')`
- [x] Export `openSettings(tab?: SettingsTab): void` — sets both signals
- [x] Export `closeSettings(): void` — sets `isSettingsOpen` to false
- [x] Export enum/union type `SettingsTab = 'general' | 'appearance' | 'themes' | 'keyboard' | 'distribution'`

### Task 2: Create SettingsPanel.tsx overlay component
- [x] Create `src/renderer/components/Settings/SettingsPanel.tsx`
- [x] Render null when `!isSettingsOpen.value` (no DOM presence when closed)
- [x] Render backdrop `<div className={styles.backdrop}>` intercepting clicks outside the card
- [x] Render settings card `<div className={styles.card}>` with max-width 600px
- [x] Add tab navigation bar with 5 tab buttons, active tab from `activeSettingsTab` signal
- [x] Render active tab content panel (switch on `activeSettingsTab.value`)
- [x] Wire Escape key listener via `useEffect` — addEventListener on document, cleanup on unmount
- [x] Backdrop click handler: `closeSettings()` (click on backdrop, not card)
- [x] Include "Edit Config File" button in header: calls `window.quakeshell.config.openInEditor()` (or existing IPC)
- [x] Include close button (✕) in header corner
- [x] Trap focus within the overlay card while open (accessibility)
- [x] Export as default component

### Task 3: Create SettingsPanel.module.css
- [x] Create `src/renderer/components/Settings/SettingsPanel.module.css`
- [x] `.backdrop`: `position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; display: flex; align-items: center; justify-content: center;`
- [x] `.card`: `background: var(--bg-chrome); border: 1px solid var(--border); border-radius: 8px; width: 100%; max-width: 600px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column; z-index: 101;`
- [x] `.header`: flex row with title "Settings", "Edit Config File" link, and close button; `padding: 16px 20px; border-bottom: 1px solid var(--border);`
- [x] `.tabs`: horizontal tab bar; `display: flex; gap: 0; border-bottom: 1px solid var(--border); background: var(--bg-chrome);`
- [x] `.tab`: `padding: 10px 16px; cursor: pointer; color: var(--fg-dimmed); border-bottom: 2px solid transparent; font-size: 13px;`
- [x] `.tabActive`: `color: var(--fg-primary); border-bottom: 2px solid var(--accent);`
- [x] `.content`: `flex: 1; overflow-y: auto; padding: 20px;`
- [x] `.editConfigLink`: `font-size: 12px; color: var(--accent); cursor: pointer; text-decoration: underline;`
- [x] `.closeBtn`: `background: none; border: none; color: var(--fg-dimmed); cursor: pointer; font-size: 18px; padding: 4px;`
- [x] Animate open: `@keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }` applied to `.card`

### Task 4: Create SettingsTabs.ts constants
- [x] Create `src/renderer/components/Settings/SettingsTabs.ts`
- [x] Export `SETTINGS_TABS` ordered array: `['general', 'appearance', 'themes', 'keyboard', 'distribution']`
- [x] Export `SETTINGS_TAB_LABELS: Record<SettingsTab, string>` mapping to display names
- [x] Export the `SettingsTab` type (re-export from settings-store or define here)

### Task 5: Update App.tsx
- [x] Open `src/renderer/components/App.tsx`
- [x] Import `SettingsPanel` and `isSettingsOpen`, `openSettings` from settings-store
- [x] Mount `<SettingsPanel />` unconditionally after `<TabBar />` and `<TerminalView />` in the JSX tree (render null internally when closed)
- [x] Add `useEffect` for Ctrl+, keyboard listener: `if (e.key === ',' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openSettings(); }`
- [x] Remove Ctrl+, listener when component unmounts

### Task 6: Update TabBar.tsx
- [x] Open `src/renderer/components/TabBar/TabBar.tsx`
- [x] Import `openSettings` from settings-store
- [x] Locate or add ⚙ gear button in the tab bar (right side, after tab list)
- [x] Wire `onClick={() => openSettings()}` to the gear button
- [x] If the gear button does not exist: add `<button className={styles.settingsBtn} onClick={() => openSettings()} title="Settings (Ctrl+,)">⚙</button>`

### Task 7: Verify "Edit Config File" IPC path
- [x] Check `src/shared/channels.ts` for an existing channel that opens the config file in the default editor (look for `config:open-file` or `app:open-config`)
- [x] If missing: add `'config:open-file'` to channels.ts, handle in `src/main/ipc-handlers.ts` via `shell.openPath(configStore.path)`
- [x] Expose via preload as `window.quakeshell.config.openInEditor()`

### Task 8: Write tests
- [x] Create `src/renderer/components/Settings/SettingsPanel.test.tsx`
- [x] Test 1: overlay not in DOM when `isSettingsOpen.value = false`
- [x] Test 2: overlay renders when `isSettingsOpen.value = true`
- [x] Test 3: clicking backdrop calls `closeSettings()`
- [x] Test 4: pressing Escape calls `closeSettings()`
- [x] Test 5: all 5 tab buttons render and clicking them updates `activeSettingsTab`
- [x] Test 6: clicking close button (✕) calls `closeSettings()`

## Dev Notes

### Architecture Patterns
- **Overlay vs. new window:** Settings is a Preact overlay rendered inside the same renderer window. It does NOT use a `BrowserWindow`. This is by design — the terminal session stays alive behind the overlay.
- **State via signals:** `isSettingsOpen` and `activeSettingsTab` are `@preact/signals` signals in `settings-store.ts`. Components subscribe reactively without prop drilling.
- **No new IPC for settings data:** All config reads and writes use the already-registered `quakeshell.config.get` and `quakeshell.config.set` IPC channels from Epic 1. Do not add new channels for reading/writing settings values.
- **z-index layering:** terminal is z-index 4, tab bar z-index 3, backdrop z-index 100, card z-index 101. Confirm existing z-index values in App.tsx/TerminalView before choosing specific numbers.
- **Focus trap:** When the overlay opens, focus should move into the card. Implement a simple focus trap: on keydown Tab inside the card, cycle through focusable elements. Restore focus to the active xterm instance on close.

### Key Files to Create/Modify

| File | Action |
|------|--------|
| `src/renderer/state/settings-store.ts` | CREATE |
| `src/renderer/components/Settings/SettingsPanel.tsx` | CREATE |
| `src/renderer/components/Settings/SettingsPanel.module.css` | CREATE |
| `src/renderer/components/Settings/SettingsTabs.ts` | CREATE |
| `src/renderer/components/Settings/SettingsPanel.test.tsx` | CREATE |
| `src/renderer/components/App.tsx` | MODIFY — add overlay + Ctrl+, listener |
| `src/renderer/components/TabBar/TabBar.tsx` | MODIFY — wire ⚙ button |
| `src/shared/channels.ts` | MODIFY if `config:open-file` missing |
| `src/main/ipc-handlers.ts` | MODIFY if `config:open-file` handler missing |
| `src/preload/index.ts` | MODIFY if `openInEditor` preload bridge missing |

### TypeScript Interfaces

```typescript
// src/renderer/components/Settings/SettingsTabs.ts
export type SettingsTab = 'general' | 'appearance' | 'themes' | 'keyboard' | 'distribution';

export const SETTINGS_TABS: SettingsTab[] = [
  'general', 'appearance', 'themes', 'keyboard', 'distribution'
];

export const SETTINGS_TAB_LABELS: Record<SettingsTab, string> = {
  general: 'General',
  appearance: 'Appearance',
  themes: 'Themes',
  keyboard: 'Keyboard',
  distribution: 'Distribution',
};
```

```typescript
// src/renderer/state/settings-store.ts
import { signal } from '@preact/signals';
import type { SettingsTab } from '../components/Settings/SettingsTabs';

export const isSettingsOpen = signal<boolean>(false);
export const activeSettingsTab = signal<SettingsTab>('general');

export function openSettings(tab?: SettingsTab): void {
  if (tab) activeSettingsTab.value = tab;
  isSettingsOpen.value = true;
}

export function closeSettings(): void {
  isSettingsOpen.value = false;
}
```

```typescript
// src/renderer/components/Settings/SettingsPanel.tsx (skeleton)
import { useEffect, useRef } from 'preact/hooks';
import { isSettingsOpen, activeSettingsTab, closeSettings } from '../../state/settings-store';
import { SETTINGS_TABS, SETTINGS_TAB_LABELS } from './SettingsTabs';
import styles from './SettingsPanel.module.css';
// import tab components
import GeneralSettings from './GeneralSettings';
import AppearanceSettings from './AppearanceSettings';
import ThemesSettings from './ThemesSettings';
import KeyboardSettings from './KeyboardSettings';
import DistributionSettings from './DistributionSettings';

export default function SettingsPanel() {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSettingsOpen.value) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isSettingsOpen.value]);

  if (!isSettingsOpen.value) return null;

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) closeSettings();
  };

  const renderTabContent = () => {
    switch (activeSettingsTab.value) {
      case 'general': return <GeneralSettings />;
      case 'appearance': return <AppearanceSettings />;
      case 'themes': return <ThemesSettings />;
      case 'keyboard': return <KeyboardSettings />;
      case 'distribution': return <DistributionSettings />;
    }
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.card} ref={cardRef} role="dialog" aria-modal="true" aria-label="Settings">
        <div className={styles.header}>
          <span>Settings</span>
          <button className={styles.editConfigLink} onClick={() => window.quakeshell.config.openInEditor()}>
            Edit Config File
          </button>
          <button className={styles.closeBtn} onClick={closeSettings} aria-label="Close settings">✕</button>
        </div>
        <div className={styles.tabs} role="tablist">
          {SETTINGS_TABS.map(tab => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeSettingsTab.value === tab}
              className={`${styles.tab} ${activeSettingsTab.value === tab ? styles.tabActive : ''}`}
              onClick={() => { activeSettingsTab.value = tab; }}
            >
              {SETTINGS_TAB_LABELS[tab]}
            </button>
          ))}
        </div>
        <div className={styles.content} role="tabpanel">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}
```

### Project Structure Notes
- All Settings sub-components live under `src/renderer/components/Settings/` — create this directory.
- The `settings-store.ts` lives in `src/renderer/state/` alongside `config-store.ts` and `tab-store.ts`.
- Each tab panel (GeneralSettings, AppearanceSettings, etc.) is implemented in separate stories P2-5.2 through P2-5.6. This story creates the shell; stub out placeholder content for each tab if needed to unblock UI testing.
- Check if `src/renderer/components/Settings/` already has any partial files from a v1 settings panel before creating new files.

### References
- `src/shared/channels.ts` — existing IPC channel definitions
- `src/renderer/components/App.tsx` — where to mount overlay and add Ctrl+, listener
- `src/renderer/components/TabBar/TabBar.tsx` — where to add ⚙ gear button
- `src/renderer/state/config-store.ts` — pattern for signal-based renderer state
- `docs/planning-artifacts/architecture-v2.md` Decision P2-5 — Settings overlay architecture decision
- `docs/planning-artifacts/epics-v2.md` UX-DR-P2-10 — UX requirements for Settings overlay

## Dev Agent Record

### Completion Notes
- Implemented the renderer-side settings overlay shell, including the settings store signals, tab metadata, focus handling, backdrop dismissal, and the shared in-app modal layout.
- Wired both entry points for the overlay: `Ctrl+,` from the app shell and the tab bar gear button.
- Reused the existing config editor bridge for the header-level "Edit Config File" action instead of creating duplicate config-file IPC.

### Debug Log
- Added renderer tests covering closed/open rendering, Escape dismissal, backdrop dismissal, tab switching, and explicit close-button behavior.
- Updated the app and tab bar renderer tests to cover the settings launcher paths.
- Verified the full automated suite passes with `npm test` (42 files, 503 tests).

## File List
- src/renderer/state/settings-store.ts
- src/renderer/components/Settings/SettingsTabs.ts
- src/renderer/components/Settings/SettingsPanel.tsx
- src/renderer/components/Settings/SettingsPanel.module.css
- src/renderer/components/Settings/index.ts
- src/renderer/components/SettingsPanel.ts
- src/renderer/components/Settings/SettingsPanel.test.tsx
- src/renderer/components/App.tsx
- src/renderer/components/App.test.tsx
- src/renderer/components/TabBar/TabBar.tsx
- src/renderer/components/TabBar/TabBar.test.tsx
- src/renderer/components/Terminal/TerminalView.tsx

## Change Log
- 2026-04-05: Implemented the settings overlay shell, tab navigation model, launcher shortcuts, and renderer-level shell tests.
