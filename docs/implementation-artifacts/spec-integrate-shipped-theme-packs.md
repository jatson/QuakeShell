---
title: 'Integrate shipped theme packs'
type: 'feature'
created: '2026-04-07'
status: 'done'
baseline_commit: '570ea80a85f0c7f17052636fc8ec3096003054a8'
context:
  - 'docs/planning-artifacts/architecture-v2.md'
  - 'docs/planning-artifacts/epics-v2.md'
  - 'README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** QuakeShell already ships additional theme bundle JSON files under `themes/`, but after the regression guard only the three core built-in themes are exposed at runtime. Users therefore lose access to the extra shipped presets unless they manually recreate them as user community theme files.

**Approach:** Keep the three core built-in themes explicit for fallback and contract safety, but load the shipped theme bundle files as additional app-provided presets during startup. Surface those presets through the existing `theme:list` flow so they appear in Settings and can be activated like any other shipped theme without changing the user community-theme watcher model.

## Boundaries & Constraints

**Always:** Preserve `tokyo-night` as the guaranteed fallback core theme; keep the core three-theme contract explicit instead of reverting to “load every JSON in themes/”; preserve `%APPDATA%/QuakeShell/themes` as the only hot-reloaded user theme source; keep theme IDs stable; leave unrelated version bump changes in `package.json` and `package-lock.json` untouched.

**Ask First:** Introducing a new public `ThemeInfo.source` category beyond `bundled` and `community`; renaming or moving the existing shipped bundle JSON files on disk.

**Never:** Require users to copy shipped pack themes into AppData; treat arbitrary future JSON files in `themes/` as automatically loadable core themes; let user community themes override any app-shipped theme ID; change the fallback behavior away from `tokyo-night`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| SHIPPED_PACKS_VISIBLE | App starts with valid shipped theme bundle JSON files in `themes/` | `theme:list` returns the 3 core themes plus shipped pack themes before any user community themes | N/A |
| SHIPPED_PACK_THEME_ACTIVE | `config.theme` equals an ID defined in a shipped theme pack | `ThemeEngine.init()` activates that shipped pack theme without fallback | N/A |
| COMMUNITY_CONFLICT | User adds a community theme whose ID matches a shipped core or shipped pack theme | Community theme is skipped and the app-provided theme remains authoritative | Warn via `electron-log`; continue running |
| SHIPPED_PACK_PARSE_FAILURE | One shipped pack file contains invalid JSON or invalid theme entries | Remaining shipped themes still load and the app stays usable | Warn via `electron-log`; continue loading other files |

</frozen-after-approval>

## Code Map

- `src/main/theme-engine.ts` -- Loads app-shipped themes, resolves active theme IDs, merges theme sources, and enforces collision rules.
- `src/main/theme-engine.test.ts` -- Verifies core-theme loading, fallback behavior, shipped pack availability, and community conflict handling.
- `src/renderer/components/Settings/ThemesSettings.test.tsx` -- Verifies the Settings UI renders and applies the expanded shipped theme list.
- `README.md` -- User-facing description of available shipped themes versus community themes.

## Tasks & Acceptance

**Execution:**
- [x] `src/main/theme-engine.ts` -- add a separate loader/state path for shipped theme bundle files and merge those themes into active lookup and `theme:list` results without weakening the explicit three-core-theme guard -- exposes the extra presets while keeping the root-cause fix intact.
- [x] `src/main/theme-engine.test.ts` -- add coverage for shipped pack visibility, selection by configured theme ID, and collision handling against user community themes -- prevents regressions in both startup and runtime selection.
- [x] `src/renderer/components/Settings/ThemesSettings.test.tsx` -- update fixtures and assertions so renderer coverage reflects the larger shipped preset set -- verifies the Settings UI continues to render and apply available themes correctly.
- [x] `README.md` -- document that QuakeShell now includes the core three themes plus additional shipped theme packs and user community themes -- keeps user-facing docs aligned with runtime behavior.

**Acceptance Criteria:**
- Given valid shipped theme bundle files exist under `themes/`, when the app initializes and `theme:list` is requested, then the response includes the three core themes followed by the shipped pack themes before any user community themes.
- Given `config.theme` is set to a shipped pack theme ID, when `ThemeEngine.init()` runs, then that shipped pack theme becomes the active theme without warning or fallback.
- Given a user community theme ID conflicts with any app-shipped theme ID, when the community theme is loaded, then it is rejected with a warning and does not replace the app-shipped theme.
- Given one shipped pack file is malformed, when the app loads themes, then the error is logged and other shipped themes still remain available.

## Spec Change Log

## Design Notes

Keep the current `loadBundledThemes()` guard focused on the three core files and introduce a separate path for shipped theme packs. That preserves the regression fix, keeps fallback ownership obvious, and still gives users access to the additional curated presets already included in the repo.

## Verification

**Commands:**
- `npx vitest run src/main/theme-engine.test.ts src/renderer/components/Settings/ThemesSettings.test.tsx` -- expected: shipped pack behavior and settings rendering pass together.
- `npm run test` -- expected: full suite remains green after the theme-source expansion.

## Suggested Review Order

**Runtime loading**

- Explicit allowlists keep the core fallback fixed while enabling shipped pack expansion.
  [`theme-engine.ts:18`](../../src/main/theme-engine.ts#L18)

- The shared loader inserts shipped pack themes and now rejects duplicate shipped IDs.
  [`theme-engine.ts:92`](../../src/main/theme-engine.ts#L92)

**Behavioral guarantees**

- Startup coverage proves core themes and shipped pack themes load together.
  [`theme-engine.test.ts:163`](../../src/main/theme-engine.test.ts#L163)

- Ordering coverage keeps community themes after app-shipped presets without brittle pack indexing.
  [`theme-engine.test.ts:206`](../../src/main/theme-engine.test.ts#L206)

- Duplicate shipped IDs are pinned so later pack files cannot silently replace earlier presets.
  [`theme-engine.test.ts:223`](../../src/main/theme-engine.test.ts#L223)

**User-facing surface**

- Settings coverage shows shipped pack presets render beside existing bundled and community themes.
  [`ThemesSettings.test.tsx:114`](../../src/renderer/components/Settings/ThemesSettings.test.tsx#L114)

- The README now explains the shipped preset set and community override rule.
  [`README.md:111`](../../README.md#L111)