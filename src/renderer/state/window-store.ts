import { signal } from '@preact/signals';

export const isVisible = signal(false);

// Subscribe to window state changes from main process
const unsubscribe = window.quakeshell.window.onStateChanged((payload) => {
  isVisible.value = payload.visible;
});

// Cleanup on unload
window.addEventListener('unload', () => {
  unsubscribe();
});
