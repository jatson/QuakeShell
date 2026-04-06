import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecSync, mockInfo, mockError } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
  mockInfo: vi.fn(),
  mockError: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

vi.mock('electron-log/main', () => ({
  default: {
    scope: vi.fn(() => ({
      info: mockInfo,
      error: mockError,
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

import { register, deregister, isRegistered } from './context-menu-installer';

describe('main/context-menu-installer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('register()', () => {
    it('writes both context-menu registry trees with quoted exe paths', () => {
      register('C:\\Program Files\\QuakeShell\\quakeshell.exe');

      expect(mockExecSync).toHaveBeenCalledTimes(8);

      const commands = mockExecSync.mock.calls.map((call) => call[0] as string);
      expect(commands.filter((command) => command.includes('/ve'))).toHaveLength(4);
      expect(commands).toContain(
        'reg add "HKCU\\Software\\Classes\\Directory\\shell\\QuakeShell" /ve /d "Open QuakeShell here" /f',
      );
      expect(commands).toContain(
        'reg add "HKCU\\Software\\Classes\\Directory\\Background\\shell\\QuakeShell" /ve /d "Open QuakeShell here" /f',
      );
      expect(commands.some((command) => command.includes('%1'))).toBe(true);
      expect(commands.some((command) => command.includes('%V'))).toBe(true);
      expect(commands.some((command) => command.includes('\\"C:\\Program Files\\QuakeShell\\quakeshell.exe\\"'))).toBe(true);
      expect(mockExecSync).toHaveBeenNthCalledWith(1, expect.any(String), { stdio: 'pipe' });
      expect(mockInfo).toHaveBeenCalledWith('Context menu registered');
    });

    it('includes the app path in the command when registering a development build', () => {
      register(
        'C:\\Program Files\\Electron\\electron.exe',
        'C:\\Projects\\QuakeShell',
      );

      const commands = mockExecSync.mock.calls.map((call) => call[0] as string);
      expect(commands.some((command) => command.includes('\\"C:\\Projects\\QuakeShell\\" -- --cwd'))).toBe(true);
    });

    it('rejects non-exe paths before touching the registry', () => {
      expect(() => register('C:\\Program Files\\QuakeShell\\quakeshell.cmd')).toThrow(
        'context-menu-installer: executablePath must end with .exe',
      );
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('rejects paths containing control characters before touching the registry', () => {
      expect(() => register('C:\\Program Files\\QuakeShell\\bad\u0000path.exe')).toThrow(
        'context-menu-installer: executablePath contains illegal characters',
      );
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('rejects app paths containing control characters before touching the registry', () => {
      expect(() => register('C:\\Program Files\\Electron\\electron.exe', 'C:\\Projects\\bad\u0000path')).toThrow(
        'context-menu-installer: appPath contains illegal characters',
      );
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('logs and rethrows registration errors', () => {
      const failure = new Error('reg add failed');
      mockExecSync.mockImplementationOnce(() => {
        throw failure;
      });

      expect(() => register('C:\\Program Files\\QuakeShell\\quakeshell.exe')).toThrow(failure);
      expect(mockError).toHaveBeenCalledWith('Failed to register context menu', failure);
    });
  });

  describe('deregister()', () => {
    it('removes both registry trees with force', () => {
      deregister();

      expect(mockExecSync).toHaveBeenCalledTimes(2);
      expect(mockExecSync).toHaveBeenCalledWith(
        'reg delete "HKCU\\Software\\Classes\\Directory\\shell\\QuakeShell" /f',
        { stdio: 'pipe' },
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        'reg delete "HKCU\\Software\\Classes\\Directory\\Background\\shell\\QuakeShell" /f',
        { stdio: 'pipe' },
      );
      expect(mockInfo).toHaveBeenCalledWith('Context menu deregistered');
    });

    it('logs and rethrows deregistration errors', () => {
      const failure = new Error('reg delete failed');
      mockExecSync.mockImplementationOnce(() => {
        throw failure;
      });

      expect(() => deregister()).toThrow(failure);
      expect(mockError).toHaveBeenCalledWith('Failed to deregister context menu', failure);
    });
  });

  describe('isRegistered()', () => {
    it('returns true when the primary registry key exists', () => {
      expect(isRegistered()).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        'reg query "HKCU\\Software\\Classes\\Directory\\shell\\QuakeShell" /ve',
        { stdio: 'pipe' },
      );
    });

    it('returns false when the registry key is absent', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('query failed');
      });

      expect(isRegistered()).toBe(false);
    });
  });
});