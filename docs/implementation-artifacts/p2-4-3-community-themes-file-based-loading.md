# Story P2-4.3: Community Themes (File-Based Loading)

Status: review

## Story

As a power user, I want to drop a JSON theme file into my QuakeShell config directory and have it automatically available, so that I can use or share custom themes without modifying the app.

## Acceptance Criteria

- **AC1:** Given a valid `ThemeDefinition` JSON file placed in `%APPDATA%/QuakeShell/themes/` / When the app is running / Then `ThemeEngine` detects the new file within 2 seconds and adds the theme to the available list.
- **AC2:** Given the theme is added / When `theme:list` IPC is called / Then the community theme appears in the response alongside bundled themes.
- **AC3:** Given an invalid JSON file placed in the themes directory / When `ThemeEngine` attempts to parse it / Then it logs a warning via electron-log and skips the file; no crash.
- **AC4:** Given a community theme file that references an unknown ThemeDefinition property / When parsed / Then extra properties are ignored; the theme is loaded if required fields (`id`, `name`, `xtermTheme`, `chromeTokens`) are present and valid.
- **AC5:** Given a community theme file is deleted from the directory / When the file watcher detects the deletion / Then the theme is removed from the available list; if it was active, `ThemeEngine` falls back to `'tokyo-night'` and emits `theme:changed`.

## Tasks / Subtasks

### Task 1: Determine file watcher dependency
- [x] Check `package.json` for `chokidar` (it ships with Electron/Webpack pipelines sometimes)
- [x] If `chokidar` is present, use it — it is more robust on Windows than `fs.watch()`
- [x] If not present, use `fs.watch()` with `recursive: false` on the user themes directory
- [x] Document the choice in a comment in `theme-engine.ts`
- [x] **Do not add `chokidar` as a new dependency** unless it is already present; use `fs.watch()` otherwise

### Task 2: Resolve user themes directory path
- [x] In `theme-engine.ts`, add method `getUserThemesDir(): string`:
  ```typescript
  private getUserThemesDir(): string {
    return path.join(app.getPath('appData'), 'QuakeShell', 'themes');
  }
  ```
- [x] Ensure the directory is created on startup if it does not exist:
  ```typescript
  fs.mkdirSync(this.getUserThemesDir(), { recursive: true });
  ```
- [x] This should be called during `init()` before starting the watcher

### Task 3: Separate bundled and community theme collections
- [x] In `ThemeEngine`, replace the single `themes: Map<string, ThemeDefinition>` with two separate maps:
  ```typescript
  private bundledThemes = new Map<string, ThemeDefinition>();
  private communityThemes = new Map<string, ThemeDefinition>();
  ```
- [x] Update `listThemes()` to return a merged array: bundled first, then community:
  ```typescript
  listThemes(): ThemeDefinition[] {
    return [
      ...Array.from(this.bundledThemes.values()),
      ...Array.from(this.communityThemes.values()),
    ];
  }
  ```
- [x] Update internal theme lookup in `setActiveTheme()` to check both maps:
  ```typescript
  private findThemeById(id: string): ThemeDefinition | undefined {
    return this.bundledThemes.get(id) ?? this.communityThemes.get(id);
  }
  ```
- [x] Update `loadBundledThemes()` to populate `bundledThemes` instead of the old single map
- [x] Rename and update `isValidTheme()` — keep structure validation logic the same

### Task 4: Implement `loadCommunityThemes()`
- [x] Add method `loadCommunityThemes(): void`:
  - Read all `*.json` files from `getUserThemesDir()`
  - For each file, call `loadCommunityThemeFile(filePath)` (see below)
  - Log summary: `logger.info('Loaded N community themes')`
- [x] Add method `loadCommunityThemeFile(filePath: string): void`:
  ```typescript
  private loadCommunityThemeFile(filePath: string): void {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!this.isValidTheme(parsed)) {
        logger.warn(`Invalid theme structure in: ${filePath}`);
        return;
      }
      // Strip unknown fields — only keep known ThemeDefinition shape
      const safe: ThemeDefinition = {
        id: parsed.id,
        name: parsed.name,
        xtermTheme: parsed.xtermTheme,
        chromeTokens: parsed.chromeTokens,
      };
      this.communityThemes.set(safe.id, safe);
      logger.info(`Loaded community theme: ${safe.id} (${safe.name})`);
    } catch (err) {
      logger.warn(`Failed to parse community theme file ${filePath}:`, err);
    }
  }
  ```
- [x] Call `loadCommunityThemes()` in `init()` after `loadBundledThemes()`

### Task 5: Implement file watcher for user themes directory
- [x] Add method `watchUserThemesDir(): void`:
  - Determine whether to use `chokidar` or `fs.watch()` (see Task 1)
  - **Using `fs.watch()`:**
    ```typescript
    private watchUserThemesDir(): void {
      const dir = this.getUserThemesDir();
      this.watcher = fs.watch(dir, { persistent: false }, (event, filename) => {
        if (!filename || !filename.endsWith('.json')) return;
        const filePath = path.join(dir, filename);
        this.handleThemeFileEvent(event, filePath, filename);
      });
      this.watcher.on('error', (err) => logger.warn('Theme watcher error:', err));
    }
    ```
  - **Using `chokidar`** (if available):
    ```typescript
    private watchUserThemesDir(): void {
      const dir = this.getUserThemesDir();
      this.watcher = chokidar.watch(path.join(dir, '*.json'), {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 500 },
      });
      this.watcher.on('add', (fp) => this.handleThemeFileEvent('rename', fp, path.basename(fp)));
      this.watcher.on('change', (fp) => this.handleThemeFileEvent('change', fp, path.basename(fp)));
      this.watcher.on('unlink', (fp) => this.handleThemeFileDeletion(fp));
    }
    ```
- [x] Store watcher reference as `private watcher: fs.FSWatcher | chokidar.FSWatcher | null = null`
- [x] Add `destroy(): void` method to close the watcher:
  ```typescript
  destroy(): void {
    this.watcher?.close();
    this.watcher = null;
  }
  ```
- [x] Call `watchUserThemesDir()` at the end of `init()`
- [x] Call `themeEngine.destroy()` on `app.beforeQuit` in `src/main/index.ts`

### Task 6: Implement file event handling
- [x] Add `handleThemeFileEvent(event: string, filePath: string, filename: string): void`:
  - On `'rename'` event (`fs.watch` emits this for both add and delete):
    - Check if file exists: `fs.existsSync(filePath)`
    - If exists → `loadCommunityThemeFile(filePath)` (add or update)
    - If not exists → `handleThemeFileDeletion(filePath, filename)`
  - On `'change'` event: `loadCommunityThemeFile(filePath)` (re-parse updated file)
- [x] Add `handleThemeFileDeletion(filePath: string, filename?: string): void`:
  - Find and remove the theme from `communityThemes` by matching the file path (or derive ID from filename)
  - Strategy: after removing from Map, check if `activeTheme.id` is no longer in either map
  - If active theme was deleted: `logger.warn(...)`, call `setActiveTheme('tokyo-night')`, which will broadcast `theme:changed`
- [x] Note: `fs.watch` on Windows fires `'rename'` for both add and delete. Handle this asymmetry with `fs.existsSync`.

### Task 7: Write unit tests for community theme loading
- [x] Update `src/main/theme-engine.test.ts`
- [x] Test: `loadCommunityThemeFile()` with valid JSON adds to `communityThemes` map
- [x] Test: `loadCommunityThemeFile()` with invalid JSON (syntax error) logs warning and does not crash
- [x] Test: `loadCommunityThemeFile()` with JSON missing required field (`id`) is skipped
- [x] Test: `loadCommunityThemeFile()` with extra unknown fields strips them and loads the theme
- [x] Test: `listThemes()` returns bundled + community themes (bundled first)
- [x] Test: `handleThemeFileDeletion()` removes theme from community map
- [x] Test: if deleted theme was active, `setActiveTheme('tokyo-night')` is called and broadcast fires
- [x] Test: `watchUserThemesDir()` is called during `init()` (mock `fs.watch` / chokidar)
- [x] Use `vi.mock('fs')` and `vi.mock('electron')` as needed; use fixture `ThemeDefinition` objects

## Dev Notes

### Architecture Patterns

This story extends ThemeEngine (P2-4.1) with **Decision P2-7** (architecture-v2.md): user-installable community themes loaded from the filesystem at runtime. The main design decisions are:

**Two-map model** (bundled + community):
- Bundled themes are loaded once at startup from the packed resources directory. They are read-only and always present.
- Community themes are loaded from the user's AppData directory and can change at runtime.
- `listThemes()` always returns bundled first so bundled themes appear at the top of any UI list.
- If a community theme has the same `id` as a bundled theme, the community theme **does not** overwrite bundled — warn and skip. (Prevents a user accidentally shadowing the fallback `'tokyo-night'` theme.)

**File watcher lifecycle:**
```
app.whenReady → themeEngine.init() → watchUserThemesDir() → watcher live
app.beforeQuit → themeEngine.destroy() → watcher closed
```

**Windows `fs.watch()` behavior:** On Windows, `fs.watch()` fires `'rename'` events for both file creation and deletion (unlike macOS where it's more granular). Always use `fs.existsSync()` to differentiate:
```typescript
if (fs.existsSync(filePath)) {
  // file was added or modified
} else {
  // file was deleted
}
```

**Debouncing:** `fs.watch` can fire multiple events for a single file save (editors often write in multiple chunks). Consider a simple debounce (200ms) before re-parsing:
```typescript
private pendingReloads = new Map<string, NodeJS.Timeout>();

private scheduleReload(filePath: string): void {
  const existing = this.pendingReloads.get(filePath);
  if (existing) clearTimeout(existing);
  this.pendingReloads.set(filePath, setTimeout(() => {
    this.loadCommunityThemeFile(filePath);
    this.pendingReloads.delete(filePath);
  }, 200));
}
```

**ID collision guard:** When loading a community theme, check if its `id` is already in `bundledThemes`:
```typescript
if (this.bundledThemes.has(safe.id)) {
  logger.warn(`Community theme '${safe.id}' conflicts with a bundled theme; skipping`);
  return;
}
```

**AC1 timing (2 seconds):** The 2-second window is satisfied by `fs.watch()` on Windows, which fires almost immediately. If using `chokidar` with `awaitWriteFinish: { stabilityThreshold: 500 }`, the delay is ~500ms + debounce. Both are well within 2 seconds.

### Key Files to Create/Modify

| Operation | File | Notes |
|-----------|------|-------|
| UPDATE | `src/main/theme-engine.ts` | Add two-map model, watchUserThemesDir, loadCommunityThemes, destroy() |
| UPDATE | `src/main/theme-engine.test.ts` | Add community theme tests |
| UPDATE | `src/main/index.ts` | Call themeEngine.destroy() on app.beforeQuit |

*(No renderer changes required — community themes appear in `theme:list` responses just like bundled themes.)*

### Project Structure Notes

- The user themes directory (`%APPDATA%/QuakeShell/themes/`) is **separate** from the bundled `themes/` at repo root. The bundled dir is at `process.resourcesPath/themes` in production. Never conflate the two.
- `app.getPath('appData')` on Windows returns `C:\Users\<username>\AppData\Roaming`. The full user themes path will be `C:\Users\<username>\AppData\Roaming\QuakeShell\themes\`.
- Community themes are **not** tracked in `config.ts` — they are discovered from the filesystem. Only the active theme **ID** is stored in config. If a community theme is deleted, the stored ID becomes stale until the user changes it.
- Do not add `chokidar` as a new dependency unless it is already in `package.json`. The native `fs.watch()` is sufficient on Windows for this use case.
- The `destroy()` method must be idempotent (calling it twice should not throw).

### References

- `src/main/theme-engine.ts` — base implementation from P2-4.1
- `src/main/theme-engine.test.ts` — existing tests from P2-4.1 to extend
- `src/main/index.ts` — app lifecycle hooks (`app.beforeQuit`)
- `architecture-v2.md` Decision P2-7 — community/user theme loading specification
- Node.js `fs.watch()` docs — note Windows-specific `'rename'` event behavior
- Node.js `fs.mkdirSync({ recursive: true })` — safe directory creation

## Dev Agent Record

### Agent Model Used
GitHub Copilot (GPT-5.4)

### Debug Log References
- Focused regression run: `npx vitest run src/main/theme-engine.test.ts src/renderer/state/theme-store.test.ts src/renderer/components/ThemeStyleInjector.test.tsx src/renderer/components/Terminal/TerminalView.test.tsx src/renderer/components/App.test.tsx src/shared/config-schema.test.ts` → 93 tests passed
- Full regression run: `npm test` → 35 test files, 457 tests passed
- Repo-wide lint remains red due pre-existing alias-resolution/style issues unrelated to this epic

### Completion Notes
- Audited the existing community-theme implementation already present in the branch and confirmed the user themes directory creation, separate bundled/community theme collections, runtime file watcher lifecycle, deletion fallback, and watcher teardown satisfy AC1-AC5
- Confirmed the implementation uses the existing main-process ThemeEngine to merge community themes into `theme:list` responses without renderer changes
- Verified the community-theme behavior through the existing `theme-engine` test coverage and the full regression suite
- No new dependency installation was required for this story during this pass

### File List
- `src/main/theme-engine.ts` — community theme loading, watcher lifecycle, two-map model, and deletion fallback logic
- `src/main/theme-engine.test.ts` — community theme parsing, watcher, and deletion coverage
- `src/main/index.ts` — ThemeEngine teardown on app quit

## Change Log
- 2026-04-05: Validated the existing community-theme loading implementation and marked the story ready for review
