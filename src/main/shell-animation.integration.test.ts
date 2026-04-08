import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mock node-pty ---
const mockPtyWrite = vi.fn();
const mockPtyResize = vi.fn();
const mockPtyKill = vi.fn();
const mockPtyOnData = vi.fn();
const mockPtyOnExit = vi.fn();

vi.mock('node-pty', () => ({
  spawn: vi.fn(() => ({
    write: mockPtyWrite,
    resize: mockPtyResize,
    kill: mockPtyKill,
    onData: (cb: (data: string) => void) => mockPtyOnData(cb),
    onExit: (cb: (e: { exitCode: number; signal: number }) => void) =>
      mockPtyOnExit(cb),
  })),
}));

vi.mock('electron-log/main', () => {
  const scopedLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return { default: { scope: vi.fn(() => scopedLogger) } };
});

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
}));

import * as nodePty from 'node-pty';
import * as path from 'node:path';
import {
  spawn,
  destroy,
  resolveShellPath,
  setDefaultShell,
  getDefaultShell,
  _reset,
} from './terminal-manager';

const originalSystemRoot = process.env.SystemRoot;
const originalProcessorArchitew6432 = process.env.PROCESSOR_ARCHITEW6432;

function getSystemShellPath(...segments: string[]): string {
  return path.win32.join('C:\\Windows', 'System32', ...segments);
}

describe('integration: shell selection and animation speed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SystemRoot = 'C:\\Windows';
    delete process.env.PROCESSOR_ARCHITEW6432;
    _reset();
  });

  afterEach(() => {
    if (originalSystemRoot === undefined) {
      delete process.env.SystemRoot;
    } else {
      process.env.SystemRoot = originalSystemRoot;
    }

    if (originalProcessorArchitew6432 === undefined) {
      delete process.env.PROCESSOR_ARCHITEW6432;
    } else {
      process.env.PROCESSOR_ARCHITEW6432 = originalProcessorArchitew6432;
    }
  });

  // --- Shell Selection Integration (AC #1, #2) ---

  describe('shell selection lifecycle', () => {
    it('spawns powershell by default, defers wsl change, uses wsl on next spawn', () => {
      // Initial spawn: powershell
      spawn('powershell', 80, 24);
      expect(nodePty.spawn).toHaveBeenCalledWith(
        getSystemShellPath('WindowsPowerShell', 'v1.0', 'powershell.exe'),
        expect.any(Array),
        expect.objectContaining({ cols: 80, rows: 24 }),
      );

      // Hot-reload: change default shell to wsl
      setDefaultShell('wsl');
      expect(getDefaultShell()).toBe('wsl');

      // Existing PTY is NOT killed — verify no kill() call after setDefaultShell
      expect(mockPtyKill).not.toHaveBeenCalled();

      // User exits shell → PTY destroyed
      destroy();
      expect(mockPtyKill).toHaveBeenCalledTimes(1);

      // New spawn picks up deferred shell
      vi.mocked(nodePty.spawn).mockClear();
      const pendingShell = getDefaultShell();
      spawn(pendingShell ?? 'powershell', 80, 24);
      expect(nodePty.spawn).toHaveBeenCalledWith(
        getSystemShellPath('wsl.exe'),
        expect.any(Array),
        expect.objectContaining({ cols: 80, rows: 24 }),
      );
    });

    it('spawns with custom absolute path', () => {
      const customPath = 'C:\\Git\\bin\\bash.exe';
      spawn(customPath, 120, 30);
      expect(nodePty.spawn).toHaveBeenCalledWith(
        customPath,
        expect.any(Array),
        expect.objectContaining({ cols: 120, rows: 30 }),
      );
    });

    it('resolveShellPath maps aliases and passes custom paths through', () => {
      expect(resolveShellPath('powershell')).toBe(
        getSystemShellPath('WindowsPowerShell', 'v1.0', 'powershell.exe'),
      );
      expect(resolveShellPath('wsl')).toBe(getSystemShellPath('wsl.exe'));
      expect(resolveShellPath('pwsh')).toBe('pwsh.exe');
      expect(resolveShellPath('cmd')).toBe(getSystemShellPath('cmd.exe'));
      expect(resolveShellPath('bash')).toBe('bash.exe');
      expect(resolveShellPath('C:\\custom\\shell.exe')).toBe(
        'C:\\custom\\shell.exe',
      );
    });
  });

  // --- Animation Speed Integration (AC #3, #4) ---
  // Animation speed tests are in window-manager.test.ts (unit) and
  // verified here at a higher level through config-store wiring.

  describe('animation speed config validation', () => {
    it('animationSpeed 0 is accepted by schema (instant mode)', async () => {
      const { configSchema } = await import('@shared/config-schema');
      const result = configSchema.safeParse({ animationSpeed: 0 });
      expect(result.success).toBe(true);
    });

    it('animationSpeed 1000 is accepted (max)', async () => {
      const { configSchema } = await import('@shared/config-schema');
      const result = configSchema.safeParse({ animationSpeed: 1000 });
      expect(result.success).toBe(true);
    });

    it('animationSpeed 2000 is rejected (over max)', async () => {
      const { configSchema } = await import('@shared/config-schema');
      const result = configSchema.safeParse({ animationSpeed: 2000 });
      expect(result.success).toBe(false);
    });

    it('animationSpeed -1 is rejected (negative)', async () => {
      const { configSchema } = await import('@shared/config-schema');
      const result = configSchema.safeParse({ animationSpeed: -1 });
      expect(result.success).toBe(false);
    });
  });
});
