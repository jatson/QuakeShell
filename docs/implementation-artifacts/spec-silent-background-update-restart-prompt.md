---
title: 'Silent Background Update Restart Prompt'
type: 'feature'
created: '2026-04-10'
status: 'done'
baseline_commit: '1c48eda19b921a5eef1ef8170fc0be3ae8cfdea9'
context:
  - 'docs/planning-artifacts/architecture.md'
  - 'docs/implementation-artifacts/3-6-windows-notifications-and-update-checking.md'
  - 'docs/planning-artifacts/ux-design-specification.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** QuakeShell currently requires a click before npm-managed installs update, and after installation it relies on a Windows toast to restart immediately. That breaks the desired silent-update flow and does not let the user defer restart safely while work is still open.

**Approach:** Eligible updates should download and install silently in the background as soon as a newer validated version is detected. Once installation succeeds, QuakeShell should remember that a restart is pending and surface an in-app restart prompt only when the dropdown next opens, with clear Restart now and Later actions.

## Boundaries & Constraints

**Always:** Keep semver validation and argument-array spawning for update commands; only auto-install on supported npm-managed Windows installs; do not interrupt an already open terminal session with an immediate modal or forced restart; show the restart prompt only after a successful install and a hidden-to-visible dropdown transition; if the user chooses Later, preserve the pending-restart state and re-prompt on a later dropdown open until restart succeeds; reuse the existing graceful shutdown and installed-executable relaunch path for Restart now.

**Ask First:** Changing behavior for non-npm-managed distributions; adding a user-facing setting to disable silent background install; introducing any new tray or toast copy beyond what is needed to preserve current fallback behavior.

**Never:** Never pass registry-derived version text through a shell command string; never auto-restart without explicit user consent; never show the restart prompt before an install completes; never clear pending restart state on Later; never add a third-party modal library for this flow.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Silent install happy path | Npm-managed install, validated newer version detected, update check runs | Background install starts without requiring notification click, no blocking UI appears during install, successful install marks restart pending | N/A |
| Prompt on next open | Restart is pending and the dropdown transitions from hidden to visible | Renderer shows an in-app dialog offering Restart now and Later once the terminal is visible | If renderer is not ready yet, pending state remains until a later open event can consume it |
| Delay restart | Restart prompt is visible and the user chooses Later | Dialog closes, current terminal session continues unchanged, restart remains pending, and the prompt appears again on a later dropdown open | N/A |
| Visible-session completion | Update finishes installing while the dropdown is already visible | No modal interrupts the current open session; the prompt waits until the user closes and reopens the dropdown | N/A |
| Unsupported or failed install | Build is not npm-managed, or npm install exits with failure | Existing download or failure notification path remains, and no pending restart prompt is created | Failure is logged and current session remains usable |

</frozen-after-approval>

## Code Map

- `src/main/notification-manager.ts` -- update detection, install execution, pending update state, restart handoff, and fallback notification behavior all live here today.
- `src/main/index.ts` -- already wires the restart handler to graceful shutdown and should remain the main-process integration point.
- `src/main/ipc-handlers.ts` -- forwards window visibility to the renderer and is the natural place to publish update-ready state.
- `src/shared/channels.ts` -- central registry for new update-ready and restart-action channels.
- `src/shared/ipc-types.ts` -- preload contract types for update-ready payloads and restart actions.
- `src/preload/index.ts` -- exposes renderer subscriptions and invokes for new update IPC without leaking Electron primitives.
- `src/renderer/state/window-store.ts` -- existing dropdown visibility signal that can detect hidden-to-visible transitions.
- `src/renderer/components/App.tsx` -- root renderer composition point where the restart prompt can be mounted once.
- `src/renderer/components/Onboarding/OnboardingOverlay.tsx` -- current accessible dialog pattern to mirror for focus trapping, escape handling, and role attributes.
- `src/main/notification-manager.test.ts` -- existing update coverage that should absorb the silent-install and pending-restart cases.
- `src/renderer/components/App.test.tsx` -- existing renderer integration test surface for modal mount and visibility-driven behavior.

## Tasks & Acceptance

**Execution:**
- [x] `src/main/notification-manager.ts` -- switch supported update checks from click-to-install toast flow to automatic background install, record pending restart metadata after successful install, and keep current safe fallback behavior for unsupported or failed installs -- this is the root behavior change.
- [x] `src/shared/channels.ts`, `src/shared/ipc-types.ts`, `src/preload/index.ts`, `src/main/ipc-handlers.ts` -- add typed IPC for update-ready state and explicit restart or delay actions between main and renderer -- the prompt cannot be renderer-only guesswork.
- [x] `src/renderer/state/window-store.ts` and a focused update state module under `src/renderer/state/` -- derive hidden-to-visible prompt timing and keep prompt visibility separate from raw main-process state -- this prevents modal logic from leaking into unrelated UI code.
- [x] `src/renderer/components/App.tsx` and a new update-prompt component under `src/renderer/components/` -- render an accessible in-app restart dialog with Restart now and Later actions, matching existing overlay accessibility expectations without adding new UI dependencies.
- [x] `src/main/notification-manager.test.ts`, `src/shared/shared.test.ts`, and renderer tests alongside the new prompt or App integration -- cover silent install start, pending restart signaling, delay-and-reprompt behavior, restart action, and fallback paths so the change is reviewable.
- [x] `docs/implementation-artifacts/3-6-windows-notifications-and-update-checking.md` -- append the updated update-flow expectations if implementation meaningfully changes the documented behavior from click-to-install to silent install -- keep project docs aligned with shipped behavior.

**Acceptance Criteria:**
- Given QuakeShell is running from a supported npm-managed install and a newer validated version is detected, when an update check runs, then QuakeShell starts the install in the background without requiring a notification click and without forcing visible UI during the current session.
- Given a background install completes successfully, when the user next opens the dropdown after it was hidden, then QuakeShell shows an in-app restart prompt with Restart now and Later actions.
- Given a restart is pending, when the user chooses Later, then the current session remains intact, the app does not restart, and the same prompt returns on a later dropdown open until restart succeeds.
- Given the user chooses Restart now and the installed executable can be launched, when the restart action runs, then QuakeShell relaunches the installed version and exits through the existing graceful shutdown path.
- Given QuakeShell is not on a supported npm-managed install, or the silent install fails, when an update is detected, then the existing download or failure notification path remains available and no restart prompt is queued.

## Spec Change Log

## Design Notes

The key design rule is that install completion and prompt display are separate events. Main process code owns whether an update is ready; renderer code owns whether the dropdown has just opened and whether it is safe to interrupt the user with a modal.

Suggested payload shape:

```ts
type UpdateReadyPayload = {
  version: string;
  source: 'background-install';
};
```

Suggested renderer behavior:

```ts
if (becameVisible && updateReady.value && !promptVisible.value) {
  promptVisible.value = true;
}
```

## Verification

**Commands:**
- `npm run lint` -- expected: no new lint errors in main, shared, preload, or renderer files touched by the feature
- `npm run test` -- expected: update-manager, IPC contract, and renderer prompt coverage pass without regressions

## Suggested Review Order

**Silent Update Flow**

- Moves supported installs to silent background download and single pending-restart state.
  [`notification-manager.ts:270`](../../src/main/notification-manager.ts#L270)

- Keeps restart explicit and clears pending state only after relaunch succeeds.
  [`notification-manager.ts:262`](../../src/main/notification-manager.ts#L262)

- Hooks the existing version check into the new non-interrupting install path.
  [`notification-manager.ts:380`](../../src/main/notification-manager.ts#L380)

**IPC Contract**

- Adds the dedicated channels that carry update readiness and restart actions.
  [`channels.ts:71`](../../src/shared/channels.ts#L71)

- Types the pending-update payload and app API surface end to end.
  [`ipc-types.ts:78`](../../src/shared/ipc-types.ts#L78)

- Publishes pending update state from main and guards the renderer broadcast.
  [`ipc-handlers.ts:625`](../../src/main/ipc-handlers.ts#L625)

- Exposes the renderer-facing update API through preload.
  [`index.ts:170`](../../src/preload/index.ts#L170)

**Prompt Timing And UI**

- Counts real reopen transitions instead of reacting to every visibility write.
  [`window-store.ts:4`](../../src/renderer/state/window-store.ts#L4)

- Re-prompts only on a new visible session while restart remains pending.
  [`update-store.ts:32`](../../src/renderer/state/update-store.ts#L32)

- Renders the accessible Restart now or Later decision point.
  [`UpdateRestartPrompt.tsx:110`](../../src/renderer/components/UpdateRestartPrompt.tsx#L110)

- Mounts the prompt once at the app root so the flow is globally available.
  [`App.tsx:840`](../../src/renderer/components/App.tsx#L840)

**Proof Points**

- Verifies silent install and explicit restart behavior in main-process tests.
  [`notification-manager.test.ts:288`](../../src/main/notification-manager.test.ts#L288)

- Verifies the new pending-update IPC handlers and renderer broadcast.
  [`ipc-handlers.test.ts:167`](../../src/main/ipc-handlers.test.ts#L167)

- Verifies delay-and-reprompt behavior across dropdown reopen transitions.
  [`UpdateRestartPrompt.test.tsx:102`](../../src/renderer/components/UpdateRestartPrompt.test.tsx#L102)

- Documents the shipped behavior change from toast-driven restart to deferred prompt.
  [`3-6-windows-notifications-and-update-checking.md:126`](3-6-windows-notifications-and-update-checking.md#L126)