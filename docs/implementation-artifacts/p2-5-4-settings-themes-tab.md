# Story P2-5.4: Settings — Themes Tab

Status: review

## Story
As a user, I want a Themes settings tab that shows all available themes with a live preview, so that I can visually explore and select a theme.

## Acceptance Criteria

- **AC1:** Given the Themes settings tab / When rendered / Then all available themes (bundled + community) are displayed as cards showing: theme name, colour swatch strip (6–8 representative ANSI colors), and a mini terminal preview
- **AC2:** Given user clicks a theme card / When processed / Then the live terminal behind the overlay immediately reflects the new theme (xterm.js ITheme + CSS custom properties update via ThemeStyleInjector fires); `config.theme` is persisted at this point
- **AC3:** Given user opens Settings and the currently active theme is displayed / When rendered / Then the active theme card is highlighted with a `--accent` border indicator
- **AC4:** Given user closes the Settings overlay after selecting a theme / When overlay closes / Then the selected theme remains active (no rollback — theme is applied and persisted on click)
- **AC5:** Given a community theme file exists in the user directory / When the Themes tab is opened / Then the community theme appears in the list alongside bundled themes

## Tasks / Subtasks

### Task 1: Confirm Epic 4 ThemeEngine IPC channels
- [x] Open `src/shared/channels.ts` and locate the following IPC channels from Epic 4:
  - `theme:list` — returns all available themes
  - `theme:set` — sets active theme by ID
  - `theme:get-current` — returns current theme ID
  - `theme:changed` — event emitted by main process when theme changes
- [x] If any are missing, add them to `channels.ts` (Epic 4 should have added these — confirm before adding)
- [x] Check `src/renderer/state/theme-store.ts` (from Epic 4) for existing signals: `currentThemeId`, `themes`

### Task 2: Define ThemeInfo type
- [x] Open `src/shared/ipc-types.ts`
- [x] Confirm or add `ThemeInfo` interface:
  ```
  id: string
  name: string
  source: 'bundled' | 'community'
  swatchColors: string[]   // 6–8 hex color strings from ANSI palette
  chromeAccent?: string    // accent color for swatch highlight
  ```
- [x] The `swatchColors` array should contain: background, foreground, and 6 ANSI colors (black, red, green, yellow, blue, magenta) from the theme's xterm ITheme

### Task 3: Update theme:list IPC handler to return swatchColors
- [x] Open the `theme:list` handler in `src/main/ipc-handlers.ts` (or `theme-engine.ts`)
- [x] Ensure returned theme objects include `swatchColors` array extracted from each theme's `xtermTheme` ANSI colors
- [x] `swatchColors` extraction: `[theme.xtermTheme.background, theme.xtermTheme.red, theme.xtermTheme.green, theme.xtermTheme.yellow, theme.xtermTheme.blue, theme.xtermTheme.magenta, theme.xtermTheme.cyan, theme.xtermTheme.foreground]`
- [x] Filter out any undefined entries

### Task 4: Create ThemeCard.tsx sub-component
- [x] Create `src/renderer/components/Settings/ThemeCard.tsx`
- [x] Props: `{ theme: ThemeInfo; isActive: boolean; onClick: () => void }`
- [x] Render: card container, theme name heading, color swatch strip, active indicator
- [x] Color swatch strip: `<div className={styles.swatch}>{theme.swatchColors.map(c => <span style={{ background: c }} />)}</div>`
- [x] Active indicator: when `isActive`, apply `styles.cardActive` class with `--accent` border
- [x] Card click: calls `onClick()`
- [x] Export as default component

### Task 5: Create ThemesSettings.tsx
- [x] Create `src/renderer/components/Settings/ThemesSettings.tsx`
- [x] On mount: load themes via `window.quakeshell.theme.list()` (or existing IPC invoke), store in local `themes` signal
- [x] On mount: get current theme ID from `theme-store.currentThemeId` signal (Epic 4) or via `window.quakeshell.theme.getCurrent()`
- [x] Store `activeThemeId = signal<string>('')` locally
- [x] Render grid of `<ThemeCard>` components
- [x] On card click:
  - [x] Set `activeThemeId.value = theme.id`
  - [x] Call `window.quakeshell.theme.set(theme.id)` — this triggers `theme:changed` event → ThemeStyleInjector updates live terminal
  - [x] `config.theme` is persisted by the main process `theme:set` handler
- [x] Show loading skeleton while themes are loading (see CSS task)
- [x] Show error state if `theme:list` IPC fails
- [x] Export as default component

### Task 6: Create ThemesSettings.module.css
- [x] Create `src/renderer/components/Settings/ThemesSettings.module.css`
- [x] `.grid`: `display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px;`
- [x] `.loadingGrid`: same grid layout but with skeleton placeholder cards
- [x] `.error`: `color: #ff6b6b; padding: 16px; text-align: center;`

### Task 7: Create ThemeCard.module.css
- [x] Create `src/renderer/components/Settings/ThemeCard.module.css`
- [x] `.card`: `background: var(--bg-terminal); border: 1px solid var(--border); border-radius: 6px; padding: 12px; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s;`
- [x] `.card:hover`: `border-color: var(--fg-dimmed);`
- [x] `.cardActive`: `border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent);`
- [x] `.name`: `font-size: 12px; font-weight: 600; color: var(--fg-primary); margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`
- [x] `.source`: `font-size: 10px; color: var(--fg-dimmed); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;`
- [x] `.swatch`: `display: flex; gap: 2px; height: 16px; border-radius: 2px; overflow: hidden;`
- [x] `.swatchColor`: `flex: 1; min-width: 0;` (each color block fills proportionally)
- [x] `.activeIndicator`: `margin-top: 8px; font-size: 10px; color: var(--accent); text-align: center;` — shows "✓ Active"

### Task 8: Expose theme IPC via preload
- [x] Open `src/preload/index.ts`
- [x] Confirm or add `window.quakeshell.theme` namespace:
  ```typescript
  theme: {
    list: (): Promise<ThemeInfo[]> => ipcRenderer.invoke(CHANNELS.THEME_LIST),
    set: (id: string): Promise<void> => ipcRenderer.invoke(CHANNELS.THEME_SET, id),
    getCurrent: (): Promise<string> => ipcRenderer.invoke(CHANNELS.THEME_GET_CURRENT),
  }
  ```
- [x] If already exposed from Epic 4, verify signature matches `ThemeInfo[]` return type including `swatchColors`

### Task 9: Write tests
- [x] Create `src/renderer/components/Settings/ThemesSettings.test.tsx`
- [x] Mock `window.quakeshell.theme.list/set/getCurrent`
- [x] Test 1: renders a card for each theme returned by `theme.list()`
- [x] Test 2: active theme card has `cardActive` class
- [x] Test 3: clicking a non-active card calls `theme.set(id)` and updates `activeThemeId`
- [x] Test 4: bundled and community themes both render (different `source` badge)
- [x] Test 5: loading state shown while themes are fetching
- [x] Create `src/renderer/components/Settings/ThemeCard.test.tsx`
- [x] Test 1: renders theme name and swatch colors
- [x] Test 2: `isActive=true` applies active styles
- [x] Test 3: `onClick` is called on click

## Dev Notes

### Architecture Patterns
- **Prerequisite — Epic 4 ThemeEngine:** This story depends entirely on Epic 4 (`theme-engine.ts`, `theme-store.ts`, `theme:list` / `theme:set` IPC channels, `ThemeStyleInjector`). Do not implement this story before Epic 4 is complete.
- **Live preview on click:** `theme:set` IPC immediately applies the theme (updates CSS custom properties + xterm ITheme). There is no "preview vs. confirmed" distinction — clicking a card applies AND persists the theme. This is the simplest correct behaviour. The terminal visible behind the overlay immediately reflects the change.
- **No rollback on close:** Because theme:set persists immediately, closing the overlay without "confirming" leaves the last clicked theme applied. This is intentional per the UX spec ("clicking applies it").
- **swatchColors in ThemeInfo:** The main process `theme:list` handler must include the `swatchColors` array. If Epic 4 did not include this in the returned data, it must be added to the handler in this story. See Task 3.
- **Community themes:** The `theme:list` IPC should already return community themes if they exist (Epic 4 responsibility). This story only needs to distinguish `source: 'bundled'` vs `source: 'community'` in the card UI.
- **Grid layout:** Use CSS Grid `auto-fill` with `minmax(160px, 1fr)` so the grid reflows as panel width changes. The settings panel is max 600px, so expect 3 columns in most cases.
- **electron-log:** In the main process theme:list handler, use `electronLog.scope('theme-engine')` for any errors loading community themes.

### Key Files to Create/Modify

| File | Action |
|------|--------|
| `src/renderer/components/Settings/ThemesSettings.tsx` | CREATE |
| `src/renderer/components/Settings/ThemesSettings.module.css` | CREATE |
| `src/renderer/components/Settings/ThemeCard.tsx` | CREATE |
| `src/renderer/components/Settings/ThemeCard.module.css` | CREATE |
| `src/renderer/components/Settings/ThemesSettings.test.tsx` | CREATE |
| `src/renderer/components/Settings/ThemeCard.test.tsx` | CREATE |
| `src/shared/ipc-types.ts` | MODIFY — confirm/add `ThemeInfo` with `swatchColors` |
| `src/main/ipc-handlers.ts` or `theme-engine.ts` | MODIFY — add `swatchColors` to `theme:list` return |
| `src/preload/index.ts` | MODIFY — confirm `theme` namespace exposed |

### TypeScript Interfaces

```typescript
// src/shared/ipc-types.ts
export interface ThemeInfo {
  id: string;
  name: string;
  source: 'bundled' | 'community';
  swatchColors: string[]; // 6–8 hex colors representing the ANSI palette
  chromeAccent?: string;  // optional accent color for display
}
```

```typescript
// ThemeCard.tsx
import type { ThemeInfo } from '../../../shared/ipc-types';
import styles from './ThemeCard.module.css';

interface ThemeCardProps {
  theme: ThemeInfo;
  isActive: boolean;
  onClick: () => void;
}

export default function ThemeCard({ theme, isActive, onClick }: ThemeCardProps) {
  return (
    <div
      className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
      onClick={onClick}
      role="radio"
      aria-checked={isActive}
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      <div className={styles.name}>{theme.name}</div>
      <div className={styles.source}>{theme.source}</div>
      <div className={styles.swatch}>
        {theme.swatchColors.map((c, i) => (
          <span key={i} className={styles.swatchColor} style={{ background: c }} />
        ))}
      </div>
      {isActive && <div className={styles.activeIndicator}>✓ Active</div>}
    </div>
  );
}
```

```typescript
// ThemesSettings.tsx
import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { ThemeInfo } from '../../../shared/ipc-types';
import ThemeCard from './ThemeCard';
import styles from './ThemesSettings.module.css';

const themes = signal<ThemeInfo[]>([]);
const activeThemeId = signal<string>('');
const isLoading = signal<boolean>(true);
const loadError = signal<string>('');

export default function ThemesSettings() {
  useEffect(() => {
    (async () => {
      try {
        isLoading.value = true;
        [themes.value, activeThemeId.value] = await Promise.all([
          window.quakeshell.theme.list(),
          window.quakeshell.theme.getCurrent(),
        ]);
      } catch (e) {
        loadError.value = e instanceof Error ? e.message : 'Failed to load themes';
      } finally {
        isLoading.value = false;
      }
    })();
  }, []);

  const handleCardClick = async (id: string) => {
    activeThemeId.value = id;
    await window.quakeshell.theme.set(id);
  };

  if (isLoading.value) return <div className={styles.loadingGrid}>Loading themes…</div>;
  if (loadError.value) return <div className={styles.error}>{loadError.value}</div>;

  return (
    <div className={styles.grid} role="radiogroup" aria-label="Select theme">
      {themes.value.map(t => (
        <ThemeCard
          key={t.id}
          theme={t}
          isActive={activeThemeId.value === t.id}
          onClick={() => handleCardClick(t.id)}
        />
      ))}
    </div>
  );
}
```

### swatchColors Extraction

```typescript
// In theme:list IPC handler (main process), add swatchColors extraction:
function extractSwatchColors(xtermTheme: ITheme): string[] {
  return [
    xtermTheme.background,
    xtermTheme.red,
    xtermTheme.green,
    xtermTheme.yellow,
    xtermTheme.blue,
    xtermTheme.magenta,
    xtermTheme.cyan,
    xtermTheme.foreground,
  ].filter((c): c is string => typeof c === 'string' && c.length > 0);
}
```

### Project Structure Notes
- If `theme-store.ts` from Epic 4 already tracks `currentThemeId` as a signal, prefer subscribing to it directly instead of fetching via `getCurrent()` IPC on mount — this ensures the displayed active theme is always in sync.
- The ThemeCard uses `role="radio"` and `aria-checked` so screen readers understand the theme selection group. Wrap the grid in `role="radiogroup"`.
- Keyboard navigation: ThemeCard handles Enter/Space for activation. Tab cycles through cards naturally.
- Do not attempt to render an actual terminal in the theme card (mini terminal preview). The colour swatch strip is sufficient visual representation. The real terminal behind the overlay serves as the true live preview.

### References
- `src/renderer/state/theme-store.ts` — Epic 4 theme signals (prerequisite)

## Dev Agent Record

### Completion Notes
- Implemented the Themes tab grid, active-state selection UI, and reusable theme cards with swatch-strip previews.
- Extended the theme IPC surface so renderer code can fetch the active theme ID and receive richer `ThemeInfo` objects including swatch colors.
- Added main-process swatch extraction and fallback handling so bundled and community themes render consistently in the settings UI.

### Debug Log
- Added renderer tests covering theme loading, active-card styling, card clicks, source badges, and theme-card interaction behavior.
- Added main-process compatibility logic so `theme:list` can fall back cleanly when older mocks only expose `listThemes()`.
- Verified the full automated suite passes with `npm test` (42 files, 503 tests).

## File List
- src/renderer/components/Settings/ThemesSettings.tsx
- src/renderer/components/Settings/ThemesSettings.module.css
- src/renderer/components/Settings/ThemesSettings.test.tsx
- src/renderer/components/Settings/ThemeCard.tsx
- src/renderer/components/Settings/ThemeCard.module.css
- src/renderer/components/Settings/ThemeCard.test.tsx
- src/preload/index.ts
- src/shared/channels.ts
- src/shared/ipc-types.ts
- src/main/ipc-handlers.ts
- src/main/theme-engine.ts

## Change Log
- 2026-04-05: Implemented the Themes settings tab, theme card UI, swatch-aware theme metadata, and theme selection tests.
- `src/main/theme-engine.ts` — Epic 4 ThemeEngine (prerequisite)
- `src/shared/channels.ts` — `theme:list`, `theme:set`, `theme:get-current`, `theme:changed`
- Story P2-5.1 — SettingsPanel shell
- `docs/planning-artifacts/architecture-v2.md` — ThemeEngine architecture (Epic 4 section)
