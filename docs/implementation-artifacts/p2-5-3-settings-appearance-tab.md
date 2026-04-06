# Story P2-5.3: Settings — Appearance Tab

Status: review

## Story
As a user, I want an Appearance settings tab with font configuration controls, so that I can adjust visual properties without editing JSON.

## Acceptance Criteria

- **AC1:** Given the Appearance settings tab / When rendered / Then it shows: font family text input, font size number input (8–48), line height number input (1.0–2.0), opacity slider (10%–100%), and a live terminal preview reflecting changes in real-time
- **AC2:** Given user types a font family name and presses Enter or tabs out / When processed / Then `config.fontFamily` is updated and the terminal reflects the new font immediately (xterm.js re-renders with the new font family if installed; silently falls back if not found)
- **AC3:** Given user changes font size / When the input loses focus (`onBlur`) / Then `config.fontSize` is updated and the terminal reflows
- **AC4:** Given user drags the opacity slider / When dragging / Then the terminal opacity updates in real-time via the existing opacity hot-reload path; the value is persisted to `config.opacity` on pointer release

## Tasks / Subtasks

### Task 1: Create AppearanceSettings.tsx
- [ ] Create `src/renderer/components/Settings/AppearanceSettings.tsx`
- [ ] On mount: load current values via `window.quakeshell.config.get` for: `fontFamily`, `fontSize`, `lineHeight`, `opacity`
- [ ] Store in local signals: `fontFamily`, `fontSize`, `lineHeight`, `opacity` (see interfaces below)
- [ ] Render using `<SettingsRow>` helper (created in P2-5.2)

**Font Family row:**
- [ ] `<input type="text">` bound to local `fontFamily` signal (controlled `value`/`onInput` for live display)
- [ ] On `onBlur` or `onKeyDown` (Enter key): call `window.quakeshell.config.set('fontFamily', value.trim())`
- [x] Create `src/renderer/components/Settings/AppearanceSettings.tsx`
- [x] On mount: load current values via `window.quakeshell.config.get` for: `fontFamily`, `fontSize`, `lineHeight`, `opacity`
- [x] Store in local signals: `fontFamily`, `fontSize`, `lineHeight`, `opacity` (see interfaces below)
- [ ] `<input type="number" min="8" max="48" step="1">` bound to `fontSize`
- [ ] On `onBlur`: validate range (clamp to 8–48), call `window.quakeshell.config.set('fontSize', clampedValue)`
- [x] `<input type="text">` bound to local `fontFamily` signal (controlled `value`/`onInput` for live display)
- [x] On `onBlur` or `onKeyDown` (Enter key): call `window.quakeshell.config.set('fontFamily', value.trim())`
- [x] Show a small hint below: "Type a font name installed on your system"
- [ ] `<input type="number" min="1.0" max="2.0" step="0.1">` bound to `lineHeight`
- [ ] On `onBlur`: validate 1.0–2.0, call `window.quakeshell.config.set('lineHeight', clampedValue)`
- [x] `<input type="number" min="8" max="48" step="1">` bound to `fontSize`
- [x] On `onBlur`: validate range (clamp to 8–48), call `window.quakeshell.config.set('fontSize', clampedValue)`
- [x] Show validation error inline if out of range before clamping
- [ ] `<input type="range" min="10" max="100" step="1">` bound to `opacity` (displayed as percentage)
- [ ] On `onInput` (every drag tick): call `window.quakeshell.config.set('opacity', value / 100)` — this triggers existing hot-reload path, terminal opacity updates immediately
- [x] `<input type="number" min="1.0" max="2.0" step="0.1">` bound to `lineHeight`
- [x] On `onBlur`: validate 1.0–2.0, call `window.quakeshell.config.set('lineHeight', clampedValue)`
- [x] Show two decimal places in input
- [ ] Export as default component

- [x] `<input type="range" min="10" max="100" step="1">` bound to `opacity` (displayed as percentage)
- [x] On `onInput` (every drag tick): call `window.quakeshell.config.set('opacity', value / 100)` — this triggers existing hot-reload path, terminal opacity updates immediately
- [x] On `onPointerUp`: final persist (same call, ensures config is saved even if onInput fires slightly before release)
- [x] Display current value as percentage label next to slider (e.g. "75%")
- [ ] `.numberInput`: same as `textInput` but `width: 80px; text-align: right;`
- [x] Export as default component
- [ ] `.sliderRow`: `display: flex; align-items: center; gap: 12px;`
- [ ] `.slider`: `flex: 1; accent-color: var(--accent);`
- [x] Create `src/renderer/components/Settings/AppearanceSettings.module.css`
- [x] `.textInput`: `width: 100%; background: var(--bg-terminal); color: var(--fg-primary); border: 1px solid var(--border); border-radius: 4px; padding: 6px 10px; font-size: 13px; font-family: inherit;`
- [x] `.textInput:focus`: `outline: none; border-color: var(--accent);`
- [x] `.numberInput`: same as `textInput` but `width: 80px; text-align: right;`
- [x] `.hint`: `font-size: 11px; color: var(--fg-dimmed); margin-top: 4px;`
- [x] `.sliderRow`: `display: flex; align-items: center; gap: 12px;`
- [x] `.slider`: `flex: 1; accent-color: var(--accent);`
- [x] `.sliderValue`: `min-width: 40px; text-align: right; font-size: 13px; color: var(--fg-primary); font-variant-numeric: tabular-nums;`
- [x] `.validationError`: `color: #ff6b6b; font-size: 11px; margin-top: 4px;`
### Task 4: Test font family application
- [ ] Verify the path: `config.set('fontFamily', 'JetBrains Mono')` → config-store emits change → renderer config-store signal updates → `TerminalView.tsx` reads `config.fontFamily` signal → calls `xterm.options.fontFamily = ...` or re-initializes xterm
- [x] Verify that `config.set('opacity', value)` in the renderer already triggers the existing opacity hot-reload path from v1 (window transparency update in the main process)
- [x] Open `src/main/ipc-handlers.ts` or `config-store.ts` to confirm that `opacity` config change dispatches a window transparency update
- [x] If the hot-reload is triggered by `config:changed` event, confirm the renderer's `window.quakeshell.config.set` emits it
- [x] No code change needed if it already works; document the finding in a code comment in `AppearanceSettings.tsx`
- [ ] Create `src/renderer/components/Settings/AppearanceSettings.test.tsx`
- [ ] Mock `window.quakeshell.config.get/set`
- [x] Verify the path: `config.set('fontFamily', 'JetBrains Mono')` → config-store emits change → renderer config-store signal updates → `TerminalView.tsx` reads `config.fontFamily` signal → calls `xterm.options.fontFamily = ...` or re-initializes xterm
- [x] If `TerminalView` does not reactively update font from signals, add the reactive update: subscribe to `config.fontFamily` signal and call `terminal.options.fontFamily = newValue`
- [x] Confirm xterm.js does NOT require terminal restart for font family change: `terminal.options.fontFamily = 'new font'` is sufficient for live update
- [ ] Test 4: slider `onInput` at value 75 calls `config.set('opacity', 0.75)`
- [ ] Test 5: line height input out of range (e.g. 3.0) shows validation error
- [x] Create `src/renderer/components/Settings/AppearanceSettings.test.tsx`
- [x] Mock `window.quakeshell.config.get/set`
- [x] Test 1: all four controls render with values loaded from config
- [x] Test 2: typing a font family and pressing Enter calls `config.set('fontFamily', value)`
- [x] Test 3: blurring font size input with value 50 clamps to 48 and calls `config.set('fontSize', 48)`
- [x] Test 4: slider `onInput` at value 75 calls `config.set('opacity', 0.75)`
- [x] Test 5: line height input out of range (e.g. 3.0) shows validation error
- **lineHeight as float:** `config.lineHeight` stores a float (1.0–2.0). The number input uses `step="0.1"`. Parse with `parseFloat`. Round to 1 decimal place before storing: `Math.round(value * 10) / 10`.
- **Controlled vs. uncontrolled inputs:** Use controlled pattern (`value={signal.value}` + `onInput={...}`) for all inputs to ensure the displayed value reflects config at all times. For font-family, update the local signal on every keystroke but only call `config.set` on blur/Enter.
- **Live terminal feedback:** The terminal is visible behind the overlay (semi-transparent backdrop). Changes to `fontFamily`, `fontSize`, `lineHeight`, `opacity` should all be visible in real time through the backdrop. This provides natural "live preview" with no extra work.

### Key Files to Create/Modify

| File | Action |
|------|--------|
| `src/renderer/components/Settings/AppearanceSettings.tsx` | CREATE |
| `src/renderer/components/Settings/AppearanceSettings.module.css` | CREATE |
| `src/renderer/components/Settings/AppearanceSettings.test.tsx` | CREATE |
| `src/renderer/components/Terminal/TerminalView.tsx` | POSSIBLY MODIFY — add reactive font update if missing |

### TypeScript Interfaces

```typescript
// Local signal state in AppearanceSettings.tsx
import { signal } from '@preact/signals';

const fontFamily = signal<string>('');
const fontSize = signal<number>(14);
const lineHeight = signal<number>(1.2);
const opacity = signal<number>(100); // percentage 10–100
const fontSizeError = signal<string>('');
const lineHeightError = signal<string>('');
```

```typescript
// AppearanceSettings.tsx component skeleton
import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import SettingsRow from './SettingsRow';
import styles from './AppearanceSettings.module.css';

// module-level signals (or use useSignal if preferred)
const fontFamily = signal('');
const fontSize = signal(14);
const lineHeight = signal(1.2);
const opacity = signal(100);
const fontSizeError = signal('');
const lineHeightError = signal('');

export default function AppearanceSettings() {
  useEffect(() => {
    (async () => {
      const cfg = window.quakeshell.config;
      fontFamily.value = await cfg.get('fontFamily') ?? 'monospace';
      fontSize.value = await cfg.get('fontSize') ?? 14;
      lineHeight.value = await cfg.get('lineHeight') ?? 1.2;
      opacity.value = Math.round((await cfg.get('opacity') ?? 1.0) * 100);
    })();
  }, []);

  const setFontFamily = async (v: string) => {
    fontFamily.value = v;
    await window.quakeshell.config.set('fontFamily', v.trim());
  };

  const setFontSize = async (raw: string) => {
    const n = parseInt(raw, 10);
    if (isNaN(n)) return;
    if (n < 8 || n > 48) {
      fontSizeError.value = 'Font size must be between 8 and 48';
      fontSize.value = Math.max(8, Math.min(48, n));
    } else {
      fontSizeError.value = '';
      fontSize.value = n;
    }
    await window.quakeshell.config.set('fontSize', fontSize.value);
  };

  const setLineHeight = async (raw: string) => {
    const n = parseFloat(raw);
    if (isNaN(n)) return;
    const clamped = Math.max(1.0, Math.min(2.0, Math.round(n * 10) / 10));
    lineHeightError.value = n !== clamped ? 'Line height must be between 1.0 and 2.0' : '';
    lineHeight.value = clamped;
    await window.quakeshell.config.set('lineHeight', clamped);
  };

  const handleOpacityInput = async (raw: string) => {
    const pct = parseInt(raw, 10);
    opacity.value = pct;
    await window.quakeshell.config.set('opacity', pct / 100);
  };

  return (
    <div>
      <SettingsRow label="Font Family" description="Monospace font installed on your system">
        <input
          type="text"
          className={styles.textInput}
          value={fontFamily.value}
          onInput={e => { fontFamily.value = (e.target as HTMLInputElement).value; }}
          onBlur={e => setFontFamily((e.target as HTMLInputElement).value)}
          onKeyDown={e => { if (e.key === 'Enter') setFontFamily((e.target as HTMLInputElement).value); }}
        />
      </SettingsRow>

      <SettingsRow label="Font Size">
        <input
          type="number" min="8" max="48" step="1"
          className={styles.numberInput}
          value={fontSize.value}
          onBlur={e => setFontSize((e.target as HTMLInputElement).value)}
        />
        {fontSizeError.value && <div className={styles.validationError}>{fontSizeError.value}</div>}
      </SettingsRow>

      <SettingsRow label="Line Height">
        <input
          type="number" min="1.0" max="2.0" step="0.1"
          className={styles.numberInput}
          value={lineHeight.value.toFixed(1)}
          onBlur={e => setLineHeight((e.target as HTMLInputElement).value)}
        />
        {lineHeightError.value && <div className={styles.validationError}>{lineHeightError.value}</div>}
      </SettingsRow>

      <SettingsRow label="Opacity">
        <div className={styles.sliderRow}>
          <input
            type="range" min="10" max="100" step="1"
            className={styles.slider}
            value={opacity.value}
            onInput={e => handleOpacityInput((e.target as HTMLInputElement).value)}
          />
          <span className={styles.sliderValue}>{opacity.value}%</span>
        </div>
      </SettingsRow>
    </div>
  );
}
```

```typescript
// TerminalView.tsx — reactive font update (if missing, add this effect)
// Inside TerminalView component:
useEffect(() => {
  const unsub = effect(() => {
    const ff = configStore.fontFamily.value;
    if (terminal) terminal.options.fontFamily = ff;
  });
  return unsub;
}, [terminal]);
```

### Project Structure Notes
- This story depends on `SettingsRow` from P2-5.2. Either implement P2-5.2 first, or create a stub `SettingsRow` here and then reconcile.
- The "live preview" through the backdrop is a natural effect of the overlay architecture. No explicit preview panel is needed — the actual running terminal IS the preview.
- Font family changes are debounced by user interaction (blur/Enter) so this is not a performance concern. Opacity changes fire on every drag tick but the IPC cost is low.

### References
- `src/shared/config-schema.ts` — `fontFamily`, `fontSize`, `lineHeight`, `opacity` key definitions and Zod validators
- `src/renderer/components/Terminal/TerminalView.tsx` — where xterm.js options are applied
- `src/renderer/state/config-store.ts` — renderer-side config signal subscriptions
- Story P2-5.2 — `SettingsRow` and `Toggle` helpers (must exist before this story)
- Story P2-5.1 — `SettingsPanel` shell (context for where this tab renders)

## Dev Agent Record

### Completion Notes
- Implemented the Appearance tab with controlled font-family, font-size, line-height, and opacity controls that persist back through the existing config bridge.
- Reused the existing opacity hot-reload behavior so the visible terminal behind the overlay acts as the live preview.
- Verified the existing terminal font update path and documented the hot-reload dependency inline rather than introducing new renderer-to-main plumbing.

### Debug Log
- Added renderer tests for config loading, font-family save on Enter, numeric clamping, opacity live updates, and line-height validation messaging.
- Confirmed the existing opacity config change path already updates window transparency without additional IPC changes.
- Verified the full automated suite passes with `npm test` (42 files, 503 tests).

## File List
- src/renderer/components/Settings/AppearanceSettings.tsx
- src/renderer/components/Settings/AppearanceSettings.module.css
- src/renderer/components/Settings/AppearanceSettings.test.tsx

## Change Log
- 2026-04-05: Implemented the Appearance settings tab with live opacity preview, font controls, validation, and renderer tests.
