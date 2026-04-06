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
  reregister,
  getConflictState,
  getRegisteredAccelerator,
  _reset,
} from './hotkey-manager';

describe('integration: hotkey remapping with conflict detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _reset();
  });

  it('full remap cycle: register → change config → old unregistered, new registered (AC: #1, #2)', () => {
    // Startup: register default hotkey
    mockRegister.mockReturnValue(true);
    const toggleFn = vi.fn();
    registerHotkey('Ctrl+Shift+Q', toggleFn);

    expect(getRegisteredAccelerator()).toBe('Ctrl+Shift+Q');
    expect(getConflictState()).toBeNull();

    vi.clearAllMocks();

    // Config change: remap to new hotkey
    mockRegister.mockReturnValue(true);
    const result = reregister('Ctrl+Shift+Q', 'Ctrl+Shift+T');

    // Old key was unregistered
    expect(mockUnregister).toHaveBeenCalledWith('Ctrl+Shift+Q');
    // New key was registered with the stored toggle callback
    expect(mockRegister).toHaveBeenCalledWith('Ctrl+Shift+T', toggleFn);
    expect(result).toBe(true);
    expect(getRegisteredAccelerator()).toBe('Ctrl+Shift+T');
    expect(getConflictState()).toBeNull();
  });

  it('conflict scenario: fail → tray fallback → change to non-conflicting → recovery (AC: #3, #4)', () => {
    // Startup: register default hotkey
    mockRegister.mockReturnValue(true);
    registerHotkey('Ctrl+Shift+Q', vi.fn());
    vi.clearAllMocks();

    // Attempt conflicting hotkey — fails
    mockRegister.mockReturnValue(false);
    const conflictResult = reregister('Ctrl+Shift+Q', 'Alt+F4');

    expect(conflictResult).toBe(false);
    expect(getConflictState()).toBe('Alt+F4');
    expect(getRegisteredAccelerator()).toBeNull();

    vi.clearAllMocks();

    // User tries different hotkey — succeeds
    mockRegister.mockReturnValue(true);
    const recoveryResult = reregister('Alt+F4', 'Ctrl+Shift+T');

    // Even though Alt+F4 was in conflict, unregister is still called (safe no-op)
    expect(mockUnregister).toHaveBeenCalledWith('Alt+F4');
    expect(recoveryResult).toBe(true);
    expect(getConflictState()).toBeNull();
    expect(getRegisteredAccelerator()).toBe('Ctrl+Shift+T');
  });

  it('startup failure: app initializes normally with tray fallback (AC: #5)', () => {
    // Startup: registration fails
    mockRegister.mockReturnValue(false);
    const toggleFn = vi.fn();
    const result = registerHotkey('Ctrl+Shift+Q', toggleFn);

    // App should not crash
    expect(result).toBe(false);
    expect(getConflictState()).toBe('Ctrl+Shift+Q');
    // No accelerator registered — tray is the only toggle method
    expect(getRegisteredAccelerator()).toBeNull();

    // Subsequent remap attempt should still work
    vi.clearAllMocks();
    mockRegister.mockReturnValue(true);
    const retryResult = reregister('Ctrl+Shift+Q', 'Ctrl+Shift+T');

    expect(retryResult).toBe(true);
    expect(getConflictState()).toBeNull();
    expect(getRegisteredAccelerator()).toBe('Ctrl+Shift+T');
  });

  it('rapid consecutive hotkey changes settle to the last valid value', () => {
    mockRegister.mockReturnValue(true);
    registerHotkey('Ctrl+Shift+Q', vi.fn());
    vi.clearAllMocks();

    // Rapid changes: Q → T → R → K
    mockRegister.mockReturnValue(true);
    reregister('Ctrl+Shift+Q', 'Ctrl+Shift+T');
    reregister('Ctrl+Shift+T', 'Ctrl+Shift+R');
    reregister('Ctrl+Shift+R', 'Ctrl+Shift+K');

    expect(getRegisteredAccelerator()).toBe('Ctrl+Shift+K');
    expect(getConflictState()).toBeNull();
    // Each old key was unregistered
    expect(mockUnregister).toHaveBeenCalledWith('Ctrl+Shift+Q');
    expect(mockUnregister).toHaveBeenCalledWith('Ctrl+Shift+T');
    expect(mockUnregister).toHaveBeenCalledWith('Ctrl+Shift+R');
  });

  it('invalid accelerator string does not crash the system', () => {
    mockRegister.mockReturnValue(true);
    registerHotkey('Ctrl+Shift+Q', vi.fn());
    vi.clearAllMocks();

    // Invalid accelerator throws
    mockRegister.mockImplementation(() => {
      throw new Error('Invalid accelerator');
    });
    const result = reregister('Ctrl+Shift+Q', '!!!INVALID!!!');

    expect(result).toBe(false);
    expect(getConflictState()).toBe('!!!INVALID!!!');
    // System is still functional — can try again
    vi.clearAllMocks();
    mockRegister.mockReturnValue(true);
    const retryResult = reregister('!!!INVALID!!!', 'Ctrl+Shift+T');
    expect(retryResult).toBe(true);
    expect(getConflictState()).toBeNull();
  });
});
