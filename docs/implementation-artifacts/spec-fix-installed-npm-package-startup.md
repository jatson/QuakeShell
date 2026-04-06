---
title: 'Fix installed npm package startup'
type: 'bugfix'
created: '2026-04-06'
status: 'done'
baseline_commit: 'd65f7e76a1a01ec4f9afa022055567bda47dd3b9'
context:
  - 'docs/implementation-artifacts/spec-quakeshell-npm-wrapper.md'
  - 'docs/planning-artifacts/architecture-v2.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The published QuakeShell npm wrapper can install and download the Windows release asset, but the packaged Electron app crashes on launch with `Cannot find module 'node-pty'`. That means the wrapper contract is currently broken for real users even though the install path succeeds.

**Approach:** Fix the Windows packaging path so the built app ships `node-pty` in a runtime-loadable location, then add a release-time verification step that fails asset creation if the packaged app does not contain the expected native-module payload.

## Boundaries & Constraints

**Always:** Keep Electron Forge + Vite as the build path; preserve the existing npm-wrapper distribution model and release asset naming; keep `node-pty` as a production dependency; make the fix work for the packaged Windows app downloaded by the npm wrapper, not only for local development.

**Ask First:** Replacing `node-pty`; changing the release asset format or installer flow; switching away from Electron Forge packaging plugins or the current wrapper distribution architecture.

**Never:** Paper over the crash only in the launcher; require manual post-install repair steps; broaden this into unrelated terminal/runtime refactors; ship another release that can package successfully while still missing the native module at runtime.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Packaged app launches | Windows release asset built from the repo and launched through the npm-installed wrapper | QuakeShell starts without a main-process `Cannot find module 'node-pty'` error | N/A |
| Native module missing from package output | Release asset build produces `app.asar` without the unpacked native module payload | Release asset creation fails before shipping the zip | Exit non-zero with a clear packaging error |
| Source checkout remains usable | Repo is used for normal Electron Forge development/package commands | Local dev/package flow still works with the native module available to the built app | Keep the fix inside packaging configuration, not app runtime hacks |

</frozen-after-approval>

## Code Map

- `forge.config.ts` -- Electron Forge packaging and plugin configuration that determines whether native modules are unpacked for runtime use
- `vite.main.config.ts` -- main-process bundle config that currently externalizes `node-pty`, so packaging must carry a runtime copy of it
- `scripts/npm/package-release.js` -- release asset builder where explicit packaged-artifact verification can stop broken zips from shipping
- `scripts/npm/package-release.test.js` -- focused tests for release asset selection and verification helpers

## Tasks & Acceptance

**Execution:**
- [x] `forge.config.ts` -- enable a packager copy surface that preserves the externalized `node-pty` module for production builds and unpack its native binary payload -- this fixes the actual startup failure inside the shipped Windows app.
- [x] `scripts/npm/package-release.js` -- add a packaged-artifact verification that asserts the built output contains the runtime-loadable `node-pty` payload before writing or publishing the release zip -- this prevents future broken assets from passing local or CI release flows.
- [x] `scripts/npm/package-release.test.js` -- cover the new packaged-native-module verification behavior and failure mode -- this keeps the regression guard durable.

**Acceptance Criteria:**
- Given a Windows release asset built from the repository, when the packaged app is launched through the npm-installed wrapper, then the main process starts without `Cannot find module 'node-pty'`.
- Given release packaging runs while the native module is absent from the packaged output, when `npm run release:asset` or `npm run release:dry-run` executes, then the command fails before shipping the release zip.
- Given normal Electron Forge development and packaging commands are run after the fix, when QuakeShell is packaged locally, then the build output contains a runtime-loadable `node-pty` payload without requiring manual file copying.

## Spec Change Log

- 2026-04-06 -- Hardened Electron Forge packaging so externalized `node-pty` ships in the Windows app, then added release-time verification for the packaged app manifest, `node-pty` wrapper files, and the unpacked Windows x64 native payload.

## Design Notes

Prefer a packaging-level fix over application-level conditionals. `node-pty` is intentionally externalized from the Vite main-process bundle, so the correct fix is to make Electron Forge copy and unpack the dependency for production packaging, then verify that packaged state during release creation.

## Verification

**Commands:**
- `npm run test:npm` -- expected: focused wrapper and release-script tests pass with the new packaging guard covered
- `npm run release:dry-run` -- expected: succeeds only if the built app contains the unpacked native module payload needed at runtime

**Observed results:**
- `npm run test:npm` -- passed with 5 files and 34 tests.
- `npm run release:dry-run` -- passed and produced `release/quakeshell-1.0.0-win32-x64.zip` after verifying `app.asar` contains the packaged app manifest plus `node-pty` wrapper files and `app.asar.unpacked` contains a Windows x64 native payload.

**Manual checks (if no CLI):**
- Launch the packaged app downloaded by the npm wrapper and confirm the previous `Cannot find module 'node-pty'` dialog no longer appears.