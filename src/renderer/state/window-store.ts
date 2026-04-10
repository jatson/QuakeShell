import { signal } from '@preact/signals';

export const isVisible = signal(false);
export const visibleSessionId = signal(0);

let lastVisible = false;

// Subscribe to window state changes from main process
const unsubscribe = window.quakeshell.window.onStateChanged((payload) => {
  if (payload.visible && !lastVisible) {
    visibleSessionId.value += 1;
  }

  lastVisible = payload.visible;
  isVisible.value = payload.visible;
});

// Cleanup on unload
window.addEventListener('unload', () => {
  unsubscribe();
});
