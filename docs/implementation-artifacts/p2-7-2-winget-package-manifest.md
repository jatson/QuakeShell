# Story P2-7.2: Winget Package Manifest

Status: ready-for-dev

## Story

As a Windows user,
I want to install QuakeShell via `winget install QuakeShell`,
so that I can use Windows' built-in package manager to install and update it.

## Acceptance Criteria

1. **Given** a new GitHub release is published **When** the release GitHub Action runs **Then** YAML manifests (installer, locale, version) are generated and a PR is automatically opened against `microsoft/winget-pkgs` via the `vedantmgoyal9/winget-releaser` GitHub Action

2. **Given** the generated Winget YAML manifests **When** validated against Winget manifest schema (v1.6.0) **Then** they contain: `PackageIdentifier`, `PackageVersion`, `InstallerType: nullsoft`, `InstallerUrl` (HTTPS), `InstallerSha256`, `PackageName`, `Publisher`, `License`, `ShortDescription`

3. **Given** the Winget PR is merged **When** a user runs `winget install QuakeShell` **Then** the Squirrel installer is downloaded and executed; QuakeShell installs correctly

4. **Given** `forge.config.ts` and all `src/` files **When** inspected **Then** they are unchanged by this story — Winget support is CI and manifest only

## Tasks / Subtasks

- [ ] Task 1: Establish a `WINGET_TOKEN` GitHub secret (AC: #1)
  - [ ] 1.1: Create a GitHub PAT with `public_repo` scope (needed to open a PR against `microsoft/winget-pkgs`)
  - [ ] 1.2: Store the token as a repository secret named `WINGET_TOKEN` on the QuakeShell GitHub repository
  - [ ] 1.3: Confirm the PAT belongs to a GitHub account that has agreed to the `microsoft/winget-pkgs` contribution terms (typically just forking the repo once via the browser is sufficient)

- [ ] Task 2: Add `publish-winget` job to `.github/workflows/release.yml` (AC: #1, #2)
  - [ ] 2.1: Open (or create) `.github/workflows/release.yml` — this file is shared with Story P2-7.1; ensure the Scoop job (`publish-scoop`) and Winget job (`publish-winget`) coexist as parallel jobs both depending on `build`
  - [ ] 2.2: Add the `publish-winget` job (see **GitHub Actions Workflow Snippet** in Dev Notes)
  - [ ] 2.3: The job uses `vedantmgoyal9/winget-releaser@v2` — pin to a specific SHA for supply-chain security (see Dev Notes for the pinned reference)
  - [ ] 2.4: Pass `identifier`, `version`, `installers`, and `token` inputs to the action (see manifest fields below)
  - [ ] 2.5: Set `release-tag` to `${{ github.ref_name }}` so the action locates the correct GitHub release asset

- [ ] Task 3: Design the Winget manifest fields (AC: #2)
  - [ ] 3.1: Determine the `PackageIdentifier` — convention is `Publisher.AppName`, e.g. `Jatson.QuakeShell`
  - [ ] 3.2: Confirm `InstallerType` is `nullsoft` — Squirrel.Windows uses NSIS under the hood; winget uses `nullsoft` for NSIS-based installers
  - [ ] 3.3: Confirm the installer URL pattern matches the Squirrel maker output: `https://github.com/[owner]/QuakeShell/releases/download/v{version}/QuakeShell-{version}-Setup.exe`
  - [ ] 3.4: Confirm `InstallerSha256` — `winget-releaser` computes this automatically from the release asset; no manual hash step needed
  - [ ] 3.5: Review the required fields table in Dev Notes; ensure all mandatory v1.6.0 fields are covered by the action's auto-generation

- [ ] Task 4: Validate the generated PR on a test release (AC: #1, #2)
  - [ ] 4.1: Create a pre-release tag (e.g. `v0.9.0-rc1`) and push it — confirm the `publish-winget` job triggers
  - [ ] 4.2: Inspect the PR opened in `microsoft/winget-pkgs` — confirm it contains three YAML files under `manifests/j/Jatson/QuakeShell/<version>/` (version, installer, defaultLocale)
  - [ ] 4.3: Run Winget manifest validation locally: `winget validate --manifest manifests/j/Jatson/QuakeShell/<version>/` inside the `winget-pkgs` fork — all checks must pass
  - [ ] 4.4: Close the draft/test PR in `winget-pkgs` before tagging the actual release

- [ ] Task 5: Validate end-to-end install after PR merge (AC: #3)
  - [ ] 5.1: After the real release PR is merged into `microsoft/winget-pkgs` and propagated (may take 24–48 h): `winget install Jatson.QuakeShell`
  - [ ] 5.2: Confirm QuakeShell installs to `%LOCALAPPDATA%\Programs` and launches via Start Menu shortcut
  - [ ] 5.3: Confirm `winget upgrade Jatson.QuakeShell` picks up a subsequent version bump after another release cycle
  - [ ] 5.4: Confirm `winget uninstall Jatson.QuakeShell` removes the application cleanly

- [ ] Task 6: Confirm `forge.config.ts` and `src/` are untouched (AC: #4)
  - [ ] 6.1: After all CI work: `git diff forge.config.ts` must return empty
  - [ ] 6.2: `git diff --name-only HEAD | grep '^src/'` must return empty

## Dev Notes

### Architecture Patterns

- **Zero src/ impact.** This story is 100% CI configuration. `forge.config.ts`, `src/`, and all renderer/main/preload files are untouched.
- **`winget-releaser` handles manifest generation automatically.** Unlike the Scoop story, there is no custom script — the `vedantmgoyal9/winget-releaser` GitHub Action introspects the GitHub release, downloads the asset, computes the SHA256, generates the three required YAML manifests, and opens a PR against `microsoft/winget-pkgs` in one step.
- **`InstallerType: nullsoft`** is the correct value for Squirrel.Windows installers. Squirrel bundles NSIS internally. Do **not** use `wix`, `inno`, or `exe` — these will fail Winget validation.
- **Manifest schema v1.6.0** is current as of 2026-04. The `winget-releaser` action targets the latest schema automatically; no manual schema version pinning is needed.
- **PR review latency.** The `microsoft/winget-pkgs` maintainers merge community PRs via automated validation bots + human review. Typically 1–3 business days. Plan releases accordingly.

### Winget Manifest Structure

The `winget-releaser` action auto-generates three files committed under `manifests/j/Jatson/QuakeShell/<version>/` in the `microsoft/winget-pkgs` PR. The fields it populates are:

**`Jatson.QuakeShell.installer.yaml`** (generated):
```yaml
PackageIdentifier: Jatson.QuakeShell
PackageVersion: 1.2.3
InstallerLocale: en-US
InstallerType: nullsoft
InstallModes:
  - interactive
  - silent
InstallerSwitches:
  Silent: /S
  SilentWithProgress: /S
Installers:
  - Architecture: x64
    InstallerUrl: https://github.com/[owner]/QuakeShell/releases/download/v1.2.3/QuakeShell-1.2.3-Setup.exe
    InstallerSha256: ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890
ManifestType: installer
ManifestVersion: 1.6.0
```

**`Jatson.QuakeShell.locale.en-US.yaml`** (generated from repo metadata):
```yaml
PackageIdentifier: Jatson.QuakeShell
PackageVersion: 1.2.3
PackageLocale: en-US
Publisher: Jatson
PublisherUrl: https://github.com/[owner]
PackageName: QuakeShell
PackageUrl: https://github.com/[owner]/QuakeShell
License: MIT
LicenseUrl: https://github.com/[owner]/QuakeShell/blob/main/LICENSE
ShortDescription: Electron drop-down terminal for Windows (like Guake)
Tags:
  - terminal
  - electron
  - windows
  - productivity
ManifestType: defaultLocale
ManifestVersion: 1.6.0
```

**`Jatson.QuakeShell.yaml`** (version manifest):
```yaml
PackageIdentifier: Jatson.QuakeShell
PackageVersion: 1.2.3
DefaultLocale: en-US
ManifestType: version
ManifestVersion: 1.6.0
```

> **Note on `PackageIdentifier`:** The identifier `Jatson.QuakeShell` follows the `Publisher.AppName` convention. The `Publisher` segment must match the first path component under `manifests/j/` exactly (case-sensitive). Confirm the casing before the first submission — it cannot be changed after the first PR is merged.

### GitHub Actions Workflow Snippet

This shows the `publish-winget` job in context with the `publish-scoop` job (from Story P2-7.1). Both jobs run in parallel after `build` completes:

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
    # ... (see Story P2-7.1 for full Scoop job definition)

  publish-winget:
    needs: [build]
    runs-on: ubuntu-latest
    steps:
      - name: Publish to Winget
        uses: vedantmgoyal9/winget-releaser@v2
        # Pin to a specific commit SHA for supply-chain security:
        # uses: vedantmgoyal9/winget-releaser@<SHA>
        # Confirm current SHA at: https://github.com/vedantmgoyal9/winget-releaser/releases
        with:
          identifier: Jatson.QuakeShell
          version: ${{ github.ref_name }}
          # Release tag — action uses this to locate the GitHub release asset
          release-tag: ${{ github.ref_name }}
          # installers-regex filters which release asset(s) to include
          installers-regex: 'QuakeShell-.*-Setup\.exe$'
          token: ${{ secrets.WINGET_TOKEN }}
```

> **Supply-chain hardening:** Replace `@v2` with `@<commit-SHA>` for pinned dependency:
> ```yaml
> uses: vedantmgoyal9/winget-releaser@bd3c054b5e580a7afe098c5f34e6ee9d8f45f10e  # v2 as of 2025-01
> ```
> Check [vedantmgoyal9/winget-releaser releases](https://github.com/vedantmgoyal9/winget-releaser/releases) for the latest stable SHA before implementation.

### Key Files to Create/Modify

| File | Action | Notes |
|---|---|---|
| `.github/workflows/release.yml` | **Create or extend** | Add `publish-winget` job; coexists with `publish-scoop` from P2-7.1 |
| `microsoft/winget-pkgs` manifests | **Auto-generated by action** | Not stored in this repo; PR opened against upstream |
| `forge.config.ts` | **Do not touch** | Must remain identical to v1 |
| `src/` | **Do not touch** | Zero renderer/main/preload changes |

### Project Structure Notes

- Squirrel maker output (confirmed from `package.json` `productName: quakeshell`): `out/make/squirrel.windows/x64/QuakeShell-<version> Setup.exe`
  - Note the space: Squirrel default naming is `{productName}-{version} Setup.exe`. Verify the exact filename produced by `npm run make` and match the `installers-regex` pattern accordingly.
  - Alternatively, configure `name` in `MakerSquirrel({})` inside `forge.config.ts` to enforce a predictable filename — **only do this if needed and only in coordination with the forge.config.ts owner**.
- `WINGET_TOKEN`: classic GitHub PAT with `public_repo` scope. Fine-grained tokens do not work for cross-repo PRs against `microsoft/winget-pkgs`.
- The `winget-releaser` action requires the GitHub release to already exist and contain the asset before it runs. The `build` job's `softprops/action-gh-release` step must complete before `publish-winget` starts — enforced by `needs: [build]`.

### Winget Validation (Local Pre-flight Check)

Before pushing a tag, validate the manifest structure locally with:

```powershell
# Install winget-create (if not already installed)
winget install Microsoft.WingetCreate

# Generate a test manifest from a local installer
wingetcreate update Jatson.QuakeShell `
  --version 1.2.3 `
  --urls "https://github.com/[owner]/QuakeShell/releases/download/v1.2.3/QuakeShell-1.2.3-Setup.exe" `
  --out ./test-manifests/

# Validate the generated manifests
winget validate --manifest ./test-manifests/
```

All validation checks must produce **no errors** before tagging a real release.

### References

- [vedantmgoyal9/winget-releaser action](https://github.com/vedantmgoyal9/winget-releaser)
- [microsoft/winget-pkgs contributing guide](https://github.com/microsoft/winget-pkgs/blob/master/CONTRIBUTING.md)
- [Winget manifest schema v1.6.0](https://github.com/microsoft/winget-pkgs/tree/master/doc/manifest/schema/1.6.0)
- [winget-create (manifest generator CLI)](https://github.com/microsoft/winget-create)
- Architecture Decision P2-9 — `docs/planning-artifacts/architecture-v2.md` line 260
- Epic definition — `docs/planning-artifacts/epics-v2.md` line 940
- Story P2-7.1 (Scoop) — `docs/implementation-artifacts/p2-7-1-scoop-package-manifest.md` (shares `.github/workflows/release.yml`)
