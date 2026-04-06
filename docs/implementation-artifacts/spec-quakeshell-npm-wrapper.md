---
title: 'Create publishable QuakeShell npm wrapper'
type: 'feature'
created: '2026-04-06'
status: 'done'
baseline_commit: 'af1c2ca4a46569b29dcf574cede3aa65bbdc083a'
context:
  - 'docs/planning-artifacts/architecture.md'
  - 'docs/planning-artifacts/product-brief-QuakeShell-distillate.md'
  - 'docs/planning-artifacts/research/technical-quake-terminal-windows-research-2026-03-31.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** QuakeShell already claims the `quakeshell` npm identity in its docs, update-check logic, and package metadata, but the repo cannot actually be published or installed from npm because the package is private and no install-time wrapper exists to provision a runnable Windows build. That leaves the documented `npm install -g quakeshell` path false and blocks the intended primary distribution channel.

**Approach:** Convert the repo into a publishable npm wrapper for the existing Electron app while preserving the current Electron Forge development flow. The published package must stay Windows-only for v1, fetch a version-matched release asset during install, expose a `quakeshell` launcher command, and align the README and package metadata with the real distribution behavior.

## Boundaries & Constraints

**Always:** Keep Electron Forge + Vite as the app build path; preserve the unscoped package name `quakeshell`; keep npm package version, release asset version, and app version aligned; treat Windows as the only supported install target for this feature; make install and launch scripts use Node built-ins or already accepted repo tooling; update documentation and metadata so the published state matches actual behavior.

**Ask First:** Switching away from GitHub Releases as the downloaded binary source; changing the public package name; broadening support beyond Windows in this package; introducing a new packaging toolchain that replaces Electron Forge for normal development.

**Never:** Publish a source-only npm package that still cannot launch QuakeShell after install; require manual file copying after `npm install -g quakeshell`; silently succeed on unsupported platforms or missing release assets; refactor unrelated runtime features while working on distribution.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Windows install succeeds | Global npm install on supported Windows with a matching release asset for the package version | Postinstall provisions the version-matched QuakeShell binary in the expected user location and the `quakeshell` command can launch it | N/A |
| Unsupported platform | Install runs on macOS, Linux, or another unsupported runtime | Install stops with a clear Windows-only message and does not mark the package as provisioned | Exit non-zero with actionable guidance |
| Asset missing or download fails | Install runs on Windows but release asset lookup, download, or extraction fails | No valid launcher state is recorded and the user gets a message describing the missing asset or failed transfer | Clean up temporary files and exit non-zero |
| Existing cached version reused | A matching version is already provisioned locally and install runs again | Postinstall recognizes the installed version and avoids corrupting or duplicating the runnable payload | Rebuild local state only if validation fails |

</frozen-after-approval>

## Code Map

- `package.json` -- npm identity, publish surface, install scripts, CLI entry, shipped file set
- `forge.config.ts` -- current Windows build/make configuration that release packaging must consume rather than replace
- `README.md` -- public install and usage contract that must match the actual npm experience
- `scripts/npm/postinstall.js` -- install-time binary resolution, download, extraction, validation, cleanup
- `scripts/npm/launcher.js` -- global command entry that locates the provisioned app and spawns it safely
- `.github/workflows/release.yml` -- build and publish automation that creates the downloadable asset before npm publish
- `scripts/npm/*.test.js` -- coverage for platform gating, failed downloads, cached installs, launcher behavior, and Windows release packaging invocation
- `scripts/npm/publish-manifest.js` -- temporary manifest swap used during npm pack/publish so the published tarball stays wrapper-only without breaking Electron Forge development packaging

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- remove the publish blocker, define the package metadata required for the public `quakeshell` package, add the CLI and install-time script entries, and restrict published contents to the wrapper surface -- this makes the registry artifact publishable and keeps npm tarballs intentional.
- [x] `scripts/npm/postinstall.js` -- implement the Windows-only provisioning flow that resolves the release asset for the current package version, downloads it, extracts or stages the runnable payload, validates the installed version, and leaves a clean failure state on errors -- this makes `npm install -g quakeshell` produce a usable installation instead of a dead package.
- [x] `scripts/npm/launcher.js` -- implement the command shim that verifies the provisioned binary exists and launches QuakeShell with forwarded arguments -- this gives users a working `quakeshell` command after global install.
- [x] `.github/workflows/release.yml` and any small supporting release script files -- create the automation that builds the Windows release asset with a deterministic name, publishes or attaches it for the same semantic version, and only then publishes the npm package -- this keeps the install script and published version in sync.
- [x] `README.md` -- replace placeholder or inaccurate npm installation claims with the actual supported workflow, Windows-only constraints, and troubleshooting expectations -- this keeps user-facing documentation honest.
- [x] `scripts/npm/*.test.ts` or equivalent test coverage -- verify platform rejection, missing asset handling, cached install detection, launcher spawn behavior, and Windows release packaging invocation -- this protects the highest-risk distribution edges.

**Acceptance Criteria:**
- Given a released QuakeShell version with its matching downloadable Windows asset, when a user runs `npm install -g quakeshell` on Windows, then installation provisions the same-version runnable app without requiring manual file placement.
- Given a successful global installation, when the user runs `quakeshell`, then the launcher starts the provisioned QuakeShell app rather than depending on the repo source tree or development tooling.
- Given installation is attempted on an unsupported platform or with a missing release asset, when postinstall finishes, then it exits with a clear actionable error and does not leave the package in a falsely valid installed state.
- Given a new release is cut, when the release automation runs, then the binary asset consumed by postinstall and the npm package version stay semantically aligned.
- Given a user reads the repo metadata and installation docs after this change, when they inspect `package.json` and `README.md`, then the public package status, install command, and platform support statements match the real shipped behavior.

## Spec Change Log

## Design Notes

Keep the development package and the published package conceptually separate. The repo remains the source-of-truth application project, while the npm artifact is a thin wrapper that ships only the launcher and install logic needed to fetch a prebuilt Windows payload. That separation preserves current local development commands while making global npm installation deterministic and small enough to reason about.

Use a deterministic asset naming convention derived from the package version and target platform so postinstall does not need to guess release contents. The launcher should read a small local manifest written by postinstall rather than hard-coding transient paths in multiple places.

## Verification

**Commands:**
- `npm run test:npm` -- actual: passed; 5 wrapper/distribution test files and 28 focused tests covered launcher, postinstall, manifest swapping, and release packaging
- `npm test` -- actual: failed in the pre-existing repository suite with unrelated `undefined.config` errors across 43 suites; not changed by this feature
- `npm pack --dry-run` -- actual: passed; the publish tarball contains only the wrapper metadata plus `README.md` and the shipped npm scripts
- `npm run release:dry-run` -- actual: passed and produced `release/quakeshell-1.0.0-win32-x64.zip` plus its `.sha256` sidecar

## Suggested Review Order

**Package Contract**

- Start here: published wrapper identity, platform gate, and npm entry points.
  [package.json:7](../../package.json#L7)

- Confirm the user-facing install path and override knobs match the shipped package.
  [README.md:45](../../README.md#L45)

**Provisioning Path**

- Installer owns Windows gating, cache reuse, downloads, checksum verification, and rollback.
  [postinstall.js:210](../../scripts/npm/postinstall.js#L210)

- Shared helpers centralize release URLs, runtime normalization, and source-checkout detection.
  [distribution.js:75](../../scripts/npm/distribution.js#L75)

- Launcher resolves validated binaries before any detached process is started.
  [launcher.js:24](../../scripts/npm/launcher.js#L24)

- Async child startup success and failure are surfaced here.
  [launcher.js:98](../../scripts/npm/launcher.js#L98)

**Publish Flow**

- Prepack swaps to the publish manifest and strips repo-only scripts.
  [publish-manifest.js:27](../../scripts/npm/publish-manifest.js#L27)

- Release packaging validates the built exe, cleans stale output, and writes checksums.
  [package-release.js:194](../../scripts/npm/package-release.js#L194)

- CI enforces tag/version alignment before asset upload and npm publish.
  [release.yml:1](../../.github/workflows/release.yml#L1)

**Verification**

- Installer tests cover cache repair, manual overrides, skip-download, and download failures.
  [postinstall.test.js:39](../../scripts/npm/postinstall.test.js#L39)

- Launcher tests cover manifests, cache fallback, manual overrides, and async spawn errors.
  [launcher.test.js:38](../../scripts/npm/launcher.test.js#L38)

- Release tests cover checksum writing, candidate selection, and embedded version checks.
  [package-release.test.js:16](../../scripts/npm/package-release.test.js#L16)

- Manifest-swap tests guard backup refresh and publish-script pruning.
  [publish-manifest.test.js:25](../../scripts/npm/publish-manifest.test.js#L25)

- Distribution tests keep x64-on-ia32 compatibility and ARM64 rejection aligned.
  [distribution.test.js:11](../../scripts/npm/distribution.test.js#L11)
