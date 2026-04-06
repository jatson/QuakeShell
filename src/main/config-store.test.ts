import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron-store before importing config-store
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockStore: Record<string, unknown> = {};
let onDidAnyChangeCallback: ((newVal: Record<string, unknown>, oldVal: Record<string, unknown>) => void) | null = null;

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      store: Record<string, unknown>;
      constructor() {
        this.store = mockStore;
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
        mockSet(key, value);
      }
      onDidAnyChange(callback: (newVal: Record<string, unknown>, oldVal: Record<string, unknown>) => void) {
        onDidAnyChangeCallback = callback;
        return () => { onDidAnyChangeCallback = null; };
      }
    },
  };
});

vi.mock('electron-log/main', () => {
  const scopedLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return {
    default: {
      scope: vi.fn(() => scopedLogger),
    },
  };
});

// Import after mocks are set up
import { createConfigStore } from './config-store';
import { configDefaults } from '@shared/config-schema';

describe('main/config-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onDidAnyChangeCallback = null;
    // Reset mock store to empty
    for (const key of Object.keys(mockStore)) {
      delete mockStore[key];
    }
  });

  describe('initialization', () => {
    it('creates store with defaults when config is empty/missing', () => {
      const store = createConfigStore();
      const all = store.getAll();
      expect(all).toEqual(configDefaults);
    });

    it('preserves valid existing config values', () => {
      mockStore['hotkey'] = 'Alt+`';
      mockStore['opacity'] = 0.5;
      const store = createConfigStore();
      const all = store.getAll();
      expect(all.hotkey).toBe('Alt+`');
      expect(all.opacity).toBe(0.5);
      // Defaults should fill in missing fields
      expect(all.defaultShell).toBe('powershell');
    });

    it('corrects invalid values to defaults and logs warnings', () => {
      mockStore['opacity'] = 5; // out of range
      mockStore['fontSize'] = 100; // out of range
      mockStore['hotkey'] = 'Ctrl+A'; // valid
      const store = createConfigStore();
      const all = store.getAll();
      // Invalid fields should fall back to defaults
      expect(all.opacity).toBe(0.85);
      expect(all.fontSize).toBe(14);
      // Valid field preserved
      expect(all.hotkey).toBe('Ctrl+A');
    });

    it('handles fully invalid config by using all defaults', () => {
      mockStore['opacity'] = 'not-a-number';
      mockStore['focusFade'] = 'not-a-boolean';
      const store = createConfigStore();
      const all = store.getAll();
      expect(all.opacity).toBe(0.85);
      expect(all.focusFade).toBe(true);
    });
  });

  describe('get()', () => {
    it('returns a specific config value by key', () => {
      const store = createConfigStore();
      expect(store.get('hotkey')).toBe('Ctrl+Shift+Q');
      expect(store.get('opacity')).toBe(0.85);
    });
  });

  describe('set()', () => {
    it('updates a valid config value', () => {
      const store = createConfigStore();
      store.set('opacity', 0.5);
      expect(store.get('opacity')).toBe(0.5);
    });

    it('rejects an invalid config value', () => {
      const store = createConfigStore();
      expect(() => store.set('opacity', 5)).toThrow();
    });

    it('rejects wrong type for config value', () => {
      const store = createConfigStore();
      expect(() => store.set('focusFade', 'yes' as unknown as boolean)).toThrow();
    });
  });

  describe('getAll()', () => {
    it('returns the complete config object', () => {
      const store = createConfigStore();
      const all = store.getAll();
      expect(all).toHaveProperty('hotkey');
      expect(all).toHaveProperty('defaultShell');
      expect(all).toHaveProperty('opacity');
      expect(all).toHaveProperty('focusFade');
      expect(all).toHaveProperty('animationSpeed');
      expect(all).toHaveProperty('fontSize');
      expect(all).toHaveProperty('fontFamily');
      expect(all).toHaveProperty('lineHeight');
      expect(all).toHaveProperty('dropHeight');
      expect(all).toHaveProperty('autostart');
      expect(all).toHaveProperty('firstRun');
    });
  });

  describe('hot-reload / onDidAnyChange', () => {
    it('detects valid external config change and updates in-memory value', () => {
      const store = createConfigStore();
      expect(store.get('opacity')).toBe(0.85);

      // Simulate external file change
      onDidAnyChangeCallback?.({ ...configDefaults, opacity: 0.5 }, {});
      expect(store.get('opacity')).toBe(0.5);
    });

    it('rejects invalid external change and keeps last-known-good value', () => {
      const store = createConfigStore();
      expect(store.get('opacity')).toBe(0.85);

      // Simulate external file change with invalid opacity
      onDidAnyChangeCallback?.({ ...configDefaults, opacity: 2.5 }, {});
      expect(store.get('opacity')).toBe(0.85);
    });

    it('handles multiple keys changed simultaneously', () => {
      const store = createConfigStore();

      onDidAnyChangeCallback?.(
        { ...configDefaults, opacity: 0.6, fontSize: 18 },
        {},
      );

      expect(store.get('opacity')).toBe(0.6);
      expect(store.get('fontSize')).toBe(18);
    });

    it('applies valid changes and rejects invalid ones in same batch', () => {
      const store = createConfigStore();

      onDidAnyChangeCallback?.(
        { ...configDefaults, opacity: 0.6, fontSize: 999 },
        {},
      );

      expect(store.get('opacity')).toBe(0.6);
      expect(store.get('fontSize')).toBe(14); // default kept
    });

    it('notifies registered change listeners with key, value, oldValue', () => {
      const store = createConfigStore();
      const listener = vi.fn();
      store.onDidChange(listener);

      onDidAnyChangeCallback?.({ ...configDefaults, opacity: 0.5 }, {});

      expect(listener).toHaveBeenCalledWith('opacity', 0.5, 0.85);
    });

    it('supports unsubscribing from change listener', () => {
      const store = createConfigStore();
      const listener = vi.fn();
      const unsubscribe = store.onDidChange(listener);

      unsubscribe();
      onDidAnyChangeCallback?.({ ...configDefaults, opacity: 0.5 }, {});

      expect(listener).not.toHaveBeenCalled();
    });

    it('notifies multiple listeners independently', () => {
      const store = createConfigStore();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      store.onDidChange(listener1);
      store.onDidChange(listener2);

      onDidAnyChangeCallback?.({ ...configDefaults, animationSpeed: 300 }, {});

      expect(listener1).toHaveBeenCalledWith('animationSpeed', 300, 200);
      expect(listener2).toHaveBeenCalledWith('animationSpeed', 300, 200);
    });

    it('does not fire listener when value has not actually changed', () => {
      const store = createConfigStore();
      const listener = vi.fn();
      store.onDidChange(listener);

      // Send the same values — no change
      onDidAnyChangeCallback?.({ ...configDefaults }, {});

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
