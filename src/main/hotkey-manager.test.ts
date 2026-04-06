import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockRegister = vi.fn(() => true);
const mockUnregister = vi.fn();
const mockUnregisterAll = vi.fn();

vi.mock('electron', () => ({
  globalShortcut: {
    register: (...args: unknown[]) => mockRegister(...args),
    unregister: (...args: unknown[]) => mockUnregister(...args),
    unregisterAll: () => mockUnregisterAll(),
  },
}));

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

import {
  registerHotkey,
  unregisterHotkey,
  unregisterAll,
  reregister,
  getConflictState,
  getRegisteredAccelerator,
  _reset,
} from './hotkey-manager';

describe('main/hotkey-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _reset();
  });

  describe('registerHotkey()', () => {
    it('registers hotkey successfully and returns true', () => {
      mockRegister.mockReturnValue(true);
      const callback = vi.fn();
      const result = registerHotkey('Ctrl+Shift+Q', callback);

      expect(result).toBe(true);
      expect(mockRegister).toHaveBeenCalledWith('Ctrl+Shift+Q', callback);
    });

    it('returns false when registration fails', () => {
      mockRegister.mockReturnValue(false);
      const callback = vi.fn();
      const result = registerHotkey('Ctrl+Shift+Q', callback);

      expect(result).toBe(false);
    });

    it('handles registration exception gracefully', () => {
      mockRegister.mockImplementation(() => {
        throw new Error('Shortcut already registered');
      });
      const callback = vi.fn();
      const result = registerHotkey('Ctrl+Shift+Q', callback);

      expect(result).toBe(false);
    });

    it('sets conflictState when registration fails', () => {
      mockRegister.mockReturnValue(false);
      registerHotkey('Ctrl+Shift+Q', vi.fn());

      expect(getConflictState()).toBe('Ctrl+Shift+Q');
    });

    it('clears conflictState on successful registration', () => {
      mockRegister.mockReturnValue(true);
      registerHotkey('Ctrl+Shift+Q', vi.fn());

      expect(getConflictState()).toBeNull();
    });

    it('sets conflictState when exception is thrown', () => {
      mockRegister.mockImplementation(() => {
        throw new Error('Invalid accelerator');
      });
      registerHotkey('InvalidKey!!!', vi.fn());

      expect(getConflictState()).toBe('InvalidKey!!!');
    });
  });

  describe('unregisterHotkey()', () => {
    it('unregisters a previously registered hotkey', () => {
      mockRegister.mockReturnValue(true);
      registerHotkey('Ctrl+Shift+Q', vi.fn());
      unregisterHotkey();

      expect(mockUnregister).toHaveBeenCalledWith('Ctrl+Shift+Q');
    });

    it('does nothing when no hotkey is registered', () => {
      unregisterHotkey();
      expect(mockUnregister).not.toHaveBeenCalled();
    });
  });

  describe('unregisterAll()', () => {
    it('cleans up all registered hotkeys', () => {
      unregisterAll();
      expect(mockUnregisterAll).toHaveBeenCalled();
    });
  });

  describe('reregister()', () => {
    it('unregisters old key and registers new key', () => {
      mockRegister.mockReturnValue(true);
      registerHotkey('Ctrl+Shift+Q', vi.fn());
      vi.clearAllMocks();

      mockRegister.mockReturnValue(true);
      const result = reregister('Ctrl+Shift+Q', 'Ctrl+Shift+T');

      expect(mockUnregister).toHaveBeenCalledWith('Ctrl+Shift+Q');
      expect(mockRegister).toHaveBeenCalledWith('Ctrl+Shift+T', expect.any(Function));
      expect(result).toBe(true);
      expect(getRegisteredAccelerator()).toBe('Ctrl+Shift+T');
    });

    it('updates currentHotkey on successful reregistration', () => {
      mockRegister.mockReturnValue(true);
      registerHotkey('Ctrl+Shift+Q', vi.fn());
      vi.clearAllMocks();

      mockRegister.mockReturnValue(true);
      reregister('Ctrl+Shift+Q', 'Alt+Space');

      expect(getRegisteredAccelerator()).toBe('Alt+Space');
      expect(getConflictState()).toBeNull();
    });

    it('returns false and sets conflictState when new key fails', () => {
      mockRegister.mockReturnValue(true);
      registerHotkey('Ctrl+Shift+Q', vi.fn());
      vi.clearAllMocks();

      mockRegister.mockReturnValue(false);
      const result = reregister('Ctrl+Shift+Q', 'Ctrl+Shift+T');

      expect(result).toBe(false);
      expect(getConflictState()).toBe('Ctrl+Shift+T');
      expect(getRegisteredAccelerator()).toBeNull();
    });

    it('handles exception during new key registration', () => {
      mockRegister.mockReturnValue(true);
      registerHotkey('Ctrl+Shift+Q', vi.fn());
      vi.clearAllMocks();

      mockRegister.mockImplementation(() => {
        throw new Error('Invalid accelerator');
      });
      const result = reregister('Ctrl+Shift+Q', 'BadKey!!!');

      expect(result).toBe(false);
      expect(getConflictState()).toBe('BadKey!!!');
    });

    it('still attempts unregister even when old key was in conflict', () => {
      // Simulate conflict: register fails
      mockRegister.mockReturnValue(false);
      registerHotkey('Ctrl+Shift+Q', vi.fn());
      vi.clearAllMocks();

      // Now reregister with a new key
      mockRegister.mockReturnValue(true);
      reregister('Ctrl+Shift+Q', 'Ctrl+Shift+T');

      // Should still attempt unregister of old key
      expect(mockUnregister).toHaveBeenCalledWith('Ctrl+Shift+Q');
      expect(getRegisteredAccelerator()).toBe('Ctrl+Shift+T');
      expect(getConflictState()).toBeNull();
    });

    it('clears conflictState before attempting new registration', () => {
      // First register fails (conflict)
      mockRegister.mockReturnValue(false);
      registerHotkey('Ctrl+Shift+Q', vi.fn());
      expect(getConflictState()).toBe('Ctrl+Shift+Q');

      // Now retry with different key — success
      mockRegister.mockReturnValue(true);
      reregister('Ctrl+Shift+Q', 'Ctrl+Shift+T');

      expect(getConflictState()).toBeNull();
    });

    it('does not crash if unregister of old key throws', () => {
      mockRegister.mockReturnValue(true);
      registerHotkey('Ctrl+Shift+Q', vi.fn());
      vi.clearAllMocks();

      mockUnregister.mockImplementation(() => {
        throw new Error('Cannot unregister');
      });
      mockRegister.mockReturnValue(true);

      const result = reregister('Ctrl+Shift+Q', 'Ctrl+Shift+T');
      expect(result).toBe(true);
    });

    it('returns false when no toggle callback is stored', () => {
      // _reset clears the callback
      const result = reregister('Ctrl+Shift+Q', 'Ctrl+Shift+T');

      expect(result).toBe(false);
      expect(mockRegister).not.toHaveBeenCalled();
    });
  });

  describe('getConflictState()', () => {
    it('returns null when no conflict exists', () => {
      expect(getConflictState()).toBeNull();
    });
  });

  describe('getRegisteredAccelerator()', () => {
    it('returns null when nothing is registered', () => {
      expect(getRegisteredAccelerator()).toBeNull();
    });

    it('returns the accelerator after successful registration', () => {
      mockRegister.mockReturnValue(true);
      registerHotkey('Ctrl+Shift+Q', vi.fn());

      expect(getRegisteredAccelerator()).toBe('Ctrl+Shift+Q');
    });
  });
});
