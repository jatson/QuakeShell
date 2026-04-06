import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configDefaults } from '@shared/config-schema';

// --- Mock electron-store with onDidAnyChange ---
let onDidAnyChangeCallback: ((newVal: Record<string, unknown>, oldVal: Record<string, unknown>) => void) | null = null;
const mockStoreData: Record<string, unknown> = {};

vi.mock('electron-store', () => ({
  default: class MockStore {
    store: Record<string, unknown>;
    constructor() {
      this.store = mockStoreData;
    }
    get(key?: string) {
      if (key === undefined) return this.store;
      return this.store[key];
    }
    set(key: string | Record<string, unknown>, value?: unknown) {
      if (typeof key === 'object') {
        Object.assign(this.store, key);
      } else {
        this.store[key] = value;
      }
    }
    onDidAnyChange(callback: (newVal: Record<string, unknown>, oldVal: Record<string, unknown>) => void) {
      onDidAnyChangeCallback = callback;
      return () => { onDidAnyChangeCallback = null; };
    }
  },
}));

const mockLoggerInstance = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));
vi.mock('electron-log/main', () => ({
  default: {
    scope: vi.fn(() => mockLoggerInstance),
  },
}));

import { createConfigStore } from '../main/config-store';

describe('integration: config hot-reload cycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onDidAnyChangeCallback = null;
    for (const key of Object.keys(mockStoreData)) {
      delete mockStoreData[key];
    }
  });

  it('full cycle: external file change → validation → listener notification', () => {
    const store = createConfigStore();
    const listener = vi.fn();
    store.onDidChange(listener);

    // Verify initial state
    expect(store.get('opacity')).toBe(0.85);
    expect(store.get('fontSize')).toBe(14);

    // Simulate external file edit: opacity changes to 0.6
    onDidAnyChangeCallback?.({ ...configDefaults, opacity: 0.6 }, {});

    // Verify: config updated, listener notified
    expect(store.get('opacity')).toBe(0.6);
    expect(listener).toHaveBeenCalledWith('opacity', 0.6, 0.85);
  });

  it('rejects invalid value and logs warning while keeping last-known-good', () => {
    const store = createConfigStore();
    const listener = vi.fn();
    store.onDidChange(listener);

    // Simulate external file edit with invalid opacity (out of range)
    onDidAnyChangeCallback?.({ ...configDefaults, opacity: 2.5 }, {});

    // Opacity should remain at default, listener should NOT be called
    expect(store.get('opacity')).toBe(0.85);
    expect(listener).not.toHaveBeenCalled();

    // Warning should be logged
    expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
      expect.stringContaining('opacity'),
    );
  });

  it('handles multiple simultaneous changes: valid opacity and valid fontSize', () => {
    const store = createConfigStore();
    const listener = vi.fn();
    store.onDidChange(listener);

    // Simulate external file edit: both opacity and fontSize change
    onDidAnyChangeCallback?.(
      { ...configDefaults, opacity: 0.7, fontSize: 18 },
      {},
    );

    // Both values should update
    expect(store.get('opacity')).toBe(0.7);
    expect(store.get('fontSize')).toBe(18);

    // Listener called once per changed key
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith('opacity', 0.7, 0.85);
    expect(listener).toHaveBeenCalledWith('fontSize', 18, 14);
  });

  it('mixed valid/invalid: applies valid changes and rejects invalid ones', () => {
    const store = createConfigStore();
    const listener = vi.fn();
    store.onDidChange(listener);

    // opacity valid (0.5), fontSize invalid (999 > max 32)
    onDidAnyChangeCallback?.(
      { ...configDefaults, opacity: 0.5, fontSize: 999 },
      {},
    );

    expect(store.get('opacity')).toBe(0.5);
    expect(store.get('fontSize')).toBe(14); // last-known-good kept

    // Only one listener call (for opacity)
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('opacity', 0.5, 0.85);
  });

  it('multiple listeners receive independent notifications', () => {
    const store = createConfigStore();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    store.onDidChange(listener1);
    store.onDidChange(listener2);

    onDidAnyChangeCallback?.({ ...configDefaults, animationSpeed: 400 }, {});

    expect(listener1).toHaveBeenCalledWith('animationSpeed', 400, 200);
    expect(listener2).toHaveBeenCalledWith('animationSpeed', 400, 200);
  });

  it('unsubscribed listener does not receive notification', () => {
    const store = createConfigStore();
    const listener = vi.fn();
    const unsubscribe = store.onDidChange(listener);

    unsubscribe();

    onDidAnyChangeCallback?.({ ...configDefaults, opacity: 0.5 }, {});

    expect(listener).not.toHaveBeenCalled();
    // But the config should still update
    expect(store.get('opacity')).toBe(0.5);
  });

  it('sequential changes are tracked correctly', () => {
    const store = createConfigStore();
    const listener = vi.fn();
    store.onDidChange(listener);

    // First change
    onDidAnyChangeCallback?.({ ...configDefaults, opacity: 0.6 }, {});
    expect(store.get('opacity')).toBe(0.6);
    expect(listener).toHaveBeenLastCalledWith('opacity', 0.6, 0.85);

    // Second change — oldValue should be 0.6 now
    onDidAnyChangeCallback?.({ ...configDefaults, opacity: 0.3 }, {});
    expect(store.get('opacity')).toBe(0.3);
    expect(listener).toHaveBeenLastCalledWith('opacity', 0.3, 0.6);
  });
});
