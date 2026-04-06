# Story P2-7.1: Scoop Package Manifest

Status: ready-for-dev

## Story

As a Windows power user,
I want to install QuakeShell via `scoop install QuakeShell`,
so that I can install and update it using my preferred package manager without visiting a download page.

## Acceptance Criteria

1. **Given** a new GitHub release is published **When** the release GitHub Action runs **Then** `scripts/generate-scoop-manifest.js` reads `package.json` version and the Squirrel installer artifact URL, generates `QuakeShell.json` matching the Scoop manifest schema, and pushes it to the `quakeshell-bucket` GitHub repository

2. **Given** the generated `QuakeShell.json` **When** validated against Scoop manifest schema **Then** it contains: `version`, `url` (HTTPS to Squirrel `.exe`), `hash` (SHA256), `installer.script` Scoop install hook, `uninstaller.script`, `bin` path

3. **Given** a user runs `scoop bucket add quakeshell https://github.com/[owner]/quakeshell-bucket` **When** followed by `scoop install QuakeShell` **Then** the Squirrel installer downloads and runs; QuakeShell installs to the Scoop apps directory

4. **Given** `forge.config.ts` **When** inspected **Then** it is unchanged from v1 — Scoop support requires no changes to the Electron Forge config

## Tasks / Subtasks

- [ ] Task 1: Create the `quakeshell-bucket` GitHub repository (AC: #1, #3)
  - [ ] 1.1: Create a new **public** GitHub repository named `quakeshell-bucket` under the same owner as the main QuakeShell repo
  - [ ] 1.2: Add a `README.md` explaining how to add the bucket: `scoop bucket add quakeshell https://github.com/[owner]/quakeshell-bucket`
  - [ ] 1.3: Add an empty `bucket/` directory with a `.gitkeep` placeholder (Scoop expects manifests under `bucket/`)
  - [ ] 1.4: Create a PAT or use a GitHub App with `contents: write` permission on `quakeshell-bucket`; store as `SCOOP_BUCKET_TOKEN` secret on the **main** QuakeShell repository

- [ ] Task 2: Create `scripts/generate-scoop-manifest.js` (AC: #1, #2)
  - [ ] 2.1: Create `scripts/generate-scoop-manifest.js` — no npm dependency; uses only Node built-ins (`fs`, `https`, `crypto`)
  - [ ] 2.2: Accept CLI args `--version`, `--url`, and `--output` (defaults to stdout):
    ```
    node scripts/generate-scoop-manifest.js \
      --version 1.2.3 \
      --url https://github.com/[owner]/QuakeShell/releases/download/v1.2.3/QuakeShell-1.2.3-Setup.exe \
      --output QuakeShell.json
    ```
  - [ ] 2.3: Download the installer `.exe` via HTTPS and compute its SHA256 digest using `crypto.createHash('sha256')`
  - [ ] 2.4: Construct the Scoop manifest object (see **Scoop Manifest Structure** in Dev Notes)
  - [ ] 2.5: Write the manifest as formatted JSON (`JSON.stringify(manifest, null, 2)`) to `--output` path or stdout
  - [ ] 2.6: Exit with code `1` and a human-readable error message if any required arg is missing or the download fails

- [ ] Task 3: Create / extend `.github/workflows/release.yml` with Scoop step (AC: #1, #3)
  - [ ] 3.1: Create `.github/workflows/release.yml` if it does not exist; otherwise add a new job `publish-scoop` (see **GitHub Actions Workflow Snippet** in Dev Notes)
  - [ ] 3.2: The job must `needs: [build]` (or whatever job produces the Squirrel `.exe` artifact)
  - [ ] 3.3: Download the Squirrel installer artifact from the GitHub release using `actions/download-artifact` or directly from the release asset URL
  - [ ] 3.4: Run `node scripts/generate-scoop-manifest.js --version ${{ github.ref_name }} --url <asset-url> --output QuakeShell.json`
  - [ ] 3.5: Commit and push `bucket/QuakeShell.json` to `quakeshell-bucket` using the `SCOOP_BUCKET_TOKEN` secret:
    ```bash
    git clone https://x-access-token:${{ secrets.SCOOP_BUCKET_TOKEN }}@github.com/[owner]/quakeshell-bucket.git bucket-repo
    cp QuakeShell.json bucket-repo/bucket/QuakeShell.json
    cd bucket-repo
    git config user.email "bot@quakeshell.dev"
    git config user.name "QuakeShell Bot"
    git add bucket/QuakeShell.json
    git commit -m "chore: update QuakeShell manifest to ${{ github.ref_name }}"
    git push
    ```
  - [ ] 3.6: Verify the push succeeded: the workflow step must not use `continue-on-error: true` — a push failure should fail the release job

- [ ] Task 4: Validate the end-to-end Scoop install flow manually (AC: #3)
  - [ ] 4.1: On a dev Windows machine: `scoop bucket add quakeshell https://github.com/[owner]/quakeshell-bucket`
  - [ ] 4.2: Run `scoop install QuakeShell` and confirm the Squirrel installer runs and QuakeShell appears in `%LOCALAPPDATA%\Programs` (Squirrel default) or within the Scoop apps directory
  - [ ] 4.3: Run `scoop update QuakeShell` after bumping the version in a test release and confirm the update installs cleanly
  - [ ] 4.4: Run `scoop uninstall QuakeShell` and confirm no leftover files in the install directory

- [ ] Task 5: Confirm `forge.config.ts` is untouched (AC: #4)
  - [ ] 5.1: After all CI/script work is complete, run `git diff forge.config.ts` and confirm the output is empty
  - [ ] 5.2: Confirm no `src/` files were modified: `git diff --name-only HEAD | grep -v '^scripts\|^\.github'` should return empty

## Dev Notes

### Architecture Patterns

- **Zero src/ impact.** This story is CI and scripts only. `forge.config.ts`, `src/`, `package.json` (beyond adding a `scripts.generate-scoop` convenience alias), and all renderer code are untouched.
- **Node built-ins only** for `generate-scoop-manifest.js`. No new npm dependencies. The script runs inside GitHub Actions on the `ubuntu-latest` runner which has Node 24 available.
- **Separate bucket repo** is the Scoop convention. Scoop's `scoop bucket add` command points at a GitHub repository root; manifests live under `bucket/*.json` within that repo.
- **SHA256 hash must be computed from the final release artifact**, not the local build. The CI step downloads the artifact URL (which already exists in the same release job) and hashes it.

### Scoop Manifest Structure

`bucket/QuakeShell.json` — the file committed to `quakeshell-bucket`:

```json
{
  "version": "1.2.3",
  "description": "Electron drop-down terminal for Windows (like Guake)",
  "homepage": "https://github.com/[owner]/QuakeShell",
  "license": "MIT",
  "url": "https://github.com/[owner]/QuakeShell/releases/download/v1.2.3/QuakeShell-1.2.3-Setup.exe",
  "hash": "sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "installer": {
    "script": [
      "$installer = \"$dir\\QuakeShell-$version-Setup.exe\"",
      "& $installer /S /D=\"$dir\" | Out-Null"
    ]
  },
  "uninstaller": {
    "script": [
      "$uninstaller = \"$dir\\unins000.exe\"",
      "if (Test-Path $uninstaller) { & $uninstaller /S | Out-Null }"
    ]
  },
  "bin": "QuakeShell.exe",
  "shortcuts": [
    ["QuakeShell.exe", "QuakeShell"]
  ],
  "checkver": {
    "github": "https://github.com/[owner]/QuakeShell"
  },
  "autoupdate": {
    "url": "https://github.com/[owner]/QuakeShell/releases/download/v$version/QuakeShell-$version-Setup.exe"
  }
}
```

> **Note on `installer.script`:** Squirrel installers accept `/S` for silent install but do not support `/D=` for custom directory the way Inno Setup does. The script above is a starting point — adjust if Squirrel's actual CLI flags differ. Confirm against Squirrel.Windows docs. Alternatively, omit `installer.script` and let Scoop use its default `.exe` installer handling (which calls the installer with no flags); Squirrel will install to its default location (`%LOCALAPPDATA%\Programs`).

### `scripts/generate-scoop-manifest.js` Skeleton

```js
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const path = require('path');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    args[argv[i].replace(/^--/, '')] = argv[i + 1];
  }
  return args;
}

async function sha256FromUrl(url) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow one redirect
        return sha256FromUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
      }
      res.on('data', (chunk) => hash.update(chunk));
      res.on('end', () => resolve(hash.digest('hex')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const { version, url, output } = args;

  if (!version || !url) {
    console.error('Usage: node generate-scoop-manifest.js --version <ver> --url <url> [--output <file>]');
    process.exit(1);
  }

  console.error(`Computing SHA256 of ${url} ...`);
  const digest = await sha256FromUrl(url);

  const manifest = {
    version,
    description: 'Electron drop-down terminal for Windows (like Guake)',
    homepage: 'https://github.com/[owner]/QuakeShell',
    license: 'MIT',
    url,
    hash: `sha256:${digest}`,
    bin: 'QuakeShell.exe',
    shortcuts: [['QuakeShell.exe', 'QuakeShell']],
    checkver: { github: 'https://github.com/[owner]/QuakeShell' },
    autoupdate: {
      url: `https://github.com/[owner]/QuakeShell/releases/download/v$version/QuakeShell-$version-Setup.exe`,
    },
  };

  const json = JSON.stringify(manifest, null, 2);
  if (output) {
    fs.writeFileSync(path.resolve(output), json, 'utf8');
    console.error(`Manifest written to ${output}`);
  } else {
    process.stdout.write(json + '\n');
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });
```

### GitHub Actions Workflow Snippet

Full `.github/workflows/release.yml` structure including the Scoop publish job:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'

      - name: Install dependencies
        run: npm ci

      - name: Build & make (Squirrel installer)
        run: npm run make
        # Produces: out/make/squirrel.windows/x64/QuakeShell-<version>-Setup.exe

      - name: Upload installer artifact
        uses: actions/upload-artifact@v4
        with:
          name: squirrel-installer
          path: out/make/squirrel.windows/x64/QuakeShell-*-Setup.exe

      - name: Create GitHub Release and upload asset
        uses: softprops/action-gh-release@v2
        with:
          files: out/make/squirrel.windows/x64/QuakeShell-*-Setup.exe
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  publish-scoop:
    needs: [build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'

      - name: Derive version and asset URL
        id: vars
        run: |
          VERSION="${{ github.ref_name }}"
          VERSION="${VERSION#v}"   # strip leading 'v'
          OWNER="${{ github.repository_owner }}"
          ASSET_URL="https://github.com/${OWNER}/QuakeShell/releases/download/${{ github.ref_name }}/QuakeShell-${VERSION}-Setup.exe"
          echo "version=${VERSION}" >> "$GITHUB_OUTPUT"
          echo "asset_url=${ASSET_URL}" >> "$GITHUB_OUTPUT"

      - name: Generate Scoop manifest
        run: |
          node scripts/generate-scoop-manifest.js \
            --version "${{ steps.vars.outputs.version }}" \
            --url "${{ steps.vars.outputs.asset_url }}" \
            --output QuakeShell.json

      - name: Push manifest to quakeshell-bucket
        env:
          SCOOP_BUCKET_TOKEN: ${{ secrets.SCOOP_BUCKET_TOKEN }}
        run: |
          OWNER="${{ github.repository_owner }}"
          git clone "https://x-access-token:${SCOOP_BUCKET_TOKEN}@github.com/${OWNER}/quakeshell-bucket.git" bucket-repo
          cp QuakeShell.json bucket-repo/bucket/QuakeShell.json
          cd bucket-repo
          git config user.email "bot@quakeshell.dev"
          git config user.name "QuakeShell Bot"
          git add bucket/QuakeShell.json
          git commit -m "chore: update QuakeShell manifest to ${{ github.ref_name }}"
          git push
```

### Key Files to Create/Modify

| File | Action | Notes |
|---|---|---|
| `scripts/generate-scoop-manifest.js` | **Create** | Node built-ins only; no new deps |
| `.github/workflows/release.yml` | **Create or extend** | Add `publish-scoop` job |
| `quakeshell-bucket/bucket/QuakeShell.json` | **Create** (in separate repo) | Auto-generated by CI; do not hand-edit |
| `forge.config.ts` | **Do not touch** | Must remain identical to v1 |
| `src/` | **Do not touch** | Zero renderer/main/preload changes |

### Project Structure Notes

- Squirrel maker output path: `out/make/squirrel.windows/x64/QuakeShell-<version>-Setup.exe` (confirmed from `@electron-forge/maker-squirrel` defaults with no `name` override in `forge.config.ts` — product name is `quakeshell` from `package.json`)
- The bucket repo must be **public** for `scoop bucket add` to work without authentication
- `SCOOP_BUCKET_TOKEN`: A classic GitHub PAT with `repo` scope (or a fine-grained token with `contents: write` on `quakeshell-bucket`). Store as a repository secret on the main QuakeShell repo

### References

- [Scoop App Manifests documentation](https://github.com/ScoopInstaller/Scoop/wiki/App-Manifests)
- [Scoop custom buckets](https://github.com/ScoopInstaller/Scoop/wiki/Buckets)
- Architecture Decision P2-9 — `docs/planning-artifacts/architecture-v2.md` line 260
- Epic definition — `docs/planning-artifacts/epics-v2.md` line 940
