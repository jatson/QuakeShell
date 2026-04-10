import { effect, signal } from '@preact/signals';
import type { PendingUpdatePayload } from '../../shared/ipc-types';
import { visibleSessionId } from './window-store';

export const pendingUpdate = signal<PendingUpdatePayload | null>(null);
export const isRestartPromptVisible = signal(false);

let unsubscribe: (() => void) | null = null;
let initPromise: Promise<void> | null = null;
let lastHandledVisibleSessionId = visibleSessionId.value;

effect(() => {
  const sessionId = visibleSessionId.value;

  if (sessionId === lastHandledVisibleSessionId) {
    return;
  }

  lastHandledVisibleSessionId = sessionId;

  if (pendingUpdate.peek()) {
    isRestartPromptVisible.value = true;
  }
});

effect(() => {
  if (!pendingUpdate.value) {
    isRestartPromptVisible.value = false;
  }
});

export function initUpdateStore(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    let sawRealtimeEvent = false;

    unsubscribe = window.quakeshell.app.onUpdateReady((payload) => {
      sawRealtimeEvent = true;
      pendingUpdate.value = payload;
    });

    const initialPendingUpdate = await window.quakeshell.app.getPendingUpdate();
    if (!sawRealtimeEvent) {
      pendingUpdate.value = initialPendingUpdate;
    }
  })().catch((error) => {
    unsubscribe?.();
    unsubscribe = null;
    initPromise = null;
    throw error;
  });

  return initPromise;
}

export async function delayPendingUpdateRestart(): Promise<PendingUpdatePayload | null> {
  const result = await window.quakeshell.app.delayPendingUpdate();
  isRestartPromptVisible.value = false;
  return result;
}

export async function restartPendingUpdateNow(): Promise<boolean> {
  return window.quakeshell.app.restartPendingUpdate();
}

window.addEventListener('unload', () => {
  unsubscribe?.();
  unsubscribe = null;
  initPromise = null;
});