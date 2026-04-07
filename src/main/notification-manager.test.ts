import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  MockNotification,
  mockAppQuit,
  mockGetVersion,
  mockShellOpenExternal,
  mockSpawn,
} = vi.hoisted(() => ({
  MockNotification: vi.fn(function (this: any) {
    this.on = vi.fn();
    this.show = vi.fn();
  }),
  mockAppQuit: vi.fn(),
  mockGetVersion: vi.fn(() => '1.0.0'),
  mockShellOpenExternal: vi.fn(() => Promise.resolve()),
  mockSpawn: vi.fn(),
}));

vi.mock('electron', () => ({
  Notification: MockNotification,
  app: {
    quit: mockAppQuit,
    getVersion: mockGetVersion,
  },
  shell: {
    openExternal: mockShellOpenExternal,
  },
}));

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

vi.mock('electron-log/main', () => {
  const scopedLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
  };
  return {
    default: {
      scope: vi.fn(() => scopedLogger),
    },
  };
});

vi.mock('./window-manager', () => ({
  isVisible: vi.fn(() => false),
  getWindow: vi.fn(() => ({
    isDestroyed: vi.fn(() => false),
    isFocused: vi.fn(() => false),
  })),
  toggle: vi.fn(),
}));

import * as windowManager from './window-manager';
import {
  send,
  isNotificationSuppressed,
  checkForUpdates,
  setUpdateRestartHandler,
} from './notification-manager';

function createMockChildProcess() {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  const child = {
    once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const existing = listeners.get(event) ?? [];
      existing.push(handler);
      listeners.set(event, existing);
      return child;
    }),
    unref: vi.fn(),
    emit(event: string, ...args: unknown[]) {
      for (const handler of listeners.get(event) ?? []) {
        handler(...args);
      }
    },
  };

  return child;
}

function createTempDirectory(prefix = 'quakeshell-update-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

const originalExecPath = process.execPath;
const temporaryPaths: string[] = [];

describe('main/notification-manager', () => {
  beforeEach(() => {
    MockNotification.mockClear();
    mockAppQuit.mockClear();
    mockShellOpenExternal.mockClear();
    mockSpawn.mockReset();
    // Re-apply constructor body after mockClear (which preserves implementation)
    // but NOT vi.restoreAllMocks() which would strip the vi.hoisted implementation
    MockNotification.mockImplementation(function (this: any) {
      this.on = vi.fn();
      this.show = vi.fn();
    });
    process.execPath = originalExecPath;
    vi.unstubAllEnvs();
    vi.mocked(windowManager.isVisible).mockReturnValue(false);
    vi.mocked(windowManager.getWindow).mockReturnValue({
      isDestroyed: vi.fn(() => false),
      isFocused: vi.fn(() => false),
    } as any);
    vi.mocked(windowManager.toggle).mockClear();
    mockGetVersion.mockReturnValue('1.0.0');
    setUpdateRestartHandler(null);
  });

  afterEach(() => {
    process.execPath = originalExecPath;
    vi.unstubAllEnvs();
    setUpdateRestartHandler(null);
    while (temporaryPaths.length > 0) {
      fs.rmSync(temporaryPaths.pop()!, { recursive: true, force: true });
    }
  });

  describe('isNotificationSuppressed()', () => {
    it('returns false when terminal is hidden', () => {
      vi.mocked(windowManager.isVisible).mockReturnValue(false);
      expect(isNotificationSuppressed()).toBe(false);
    });

    it('returns false when terminal is visible but not focused', () => {
      vi.mocked(windowManager.isVisible).mockReturnValue(true);
      vi.mocked(windowManager.getWindow).mockReturnValue({
        isDestroyed: vi.fn(() => false),
        isFocused: vi.fn(() => false),
      } as any);
      expect(isNotificationSuppressed()).toBe(false);
    });

    it('returns true when terminal is visible and focused', () => {
      vi.mocked(windowManager.isVisible).mockReturnValue(true);
      vi.mocked(windowManager.getWindow).mockReturnValue({
        isDestroyed: vi.fn(() => false),
        isFocused: vi.fn(() => true),
      } as any);
      expect(isNotificationSuppressed()).toBe(true);
    });
  });

  describe('send()', () => {
    function getLastInstance() {
      const instances = MockNotification.mock.instances;
      return instances[instances.length - 1] as any;
    }

    it('creates and shows a notification with title and body', () => {
      send({ title: 'Test', body: 'Hello' });

      expect(MockNotification).toHaveBeenCalledWith({
        title: 'Test',
        body: 'Hello',
      });
      expect(getLastInstance().show).toHaveBeenCalled();
    });

    it('registers click handler that calls provided onClick callback', () => {
      const onClick = vi.fn();
      send({ title: 'Test', body: 'Hello', onClick });

      const inst = getLastInstance();
      const clickHandler = inst.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'click',
      )![1] as Function;

      clickHandler();
      expect(onClick).toHaveBeenCalled();
    });

    it('defaults click handler to windowManager.toggle() when no onClick provided', () => {
      send({ title: 'Test', body: 'Hello' });

      const inst = getLastInstance();
      const clickHandler = inst.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'click',
      )![1] as Function;

      clickHandler();
      expect(windowManager.toggle).toHaveBeenCalled();
    });

    it('suppresses notification when terminal is visible and focused', () => {
      vi.mocked(windowManager.isVisible).mockReturnValue(true);
      vi.mocked(windowManager.getWindow).mockReturnValue({
        isDestroyed: vi.fn(() => false),
        isFocused: vi.fn(() => true),
      } as any);

      send({ title: 'Test', body: 'Hello' });

      expect(MockNotification).not.toHaveBeenCalled();
    });

    it('does NOT suppress when terminal is visible but unfocused', () => {
      vi.mocked(windowManager.isVisible).mockReturnValue(true);
      vi.mocked(windowManager.getWindow).mockReturnValue({
        isDestroyed: vi.fn(() => false),
        isFocused: vi.fn(() => false),
      } as any);

      send({ title: 'Test', body: 'Hello' });

      expect(MockNotification).toHaveBeenCalled();
      expect(getLastInstance().show).toHaveBeenCalled();
    });

    it('can bypass suppression for forced notifications', () => {
      vi.mocked(windowManager.isVisible).mockReturnValue(true);
      vi.mocked(windowManager.getWindow).mockReturnValue({
        isDestroyed: vi.fn(() => false),
        isFocused: vi.fn(() => true),
      } as any);

      send({ title: 'Test', body: 'Hello', bypassSuppression: true });

      expect(MockNotification).toHaveBeenCalledWith({
        title: 'Test',
        body: 'Hello',
      });
      expect(getLastInstance().show).toHaveBeenCalled();
    });
  });

  describe('checkForUpdates()', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    afterEach(() => {
      fetchSpy?.mockRestore();
    });

    it('shows notification when newer version available', async () => {
      mockGetVersion.mockReturnValue('1.0.0');
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '2.0.0' }),
      } as Response);

      const result = await checkForUpdates(false);

      expect(result.updateAvailable).toBe(true);
      expect(result.latestVersion).toBe('2.0.0');
      expect(MockNotification).toHaveBeenCalledWith({
        title: 'QuakeShell',
        body: 'QuakeShell v2.0.0 available. Click to download.',
      });
    });

    it('opens the latest release page when update click occurs outside npm-managed installs', async () => {
      mockGetVersion.mockReturnValue('1.0.0');
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '2.0.0' }),
      } as Response);

      await checkForUpdates(false);

      const notification = MockNotification.mock.instances[MockNotification.mock.instances.length - 1] as any;
      const clickHandler = notification.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'click',
      )![1] as Function;

      clickHandler();

      expect(mockShellOpenExternal).toHaveBeenCalledWith('https://github.com/jatson/QuakeShell/releases/tag/v2.0.0');
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('installs updates on notification click for npm-managed builds and restarts into the new executable', async () => {
      const installRoot = createTempDirectory();
      temporaryPaths.push(installRoot);
      vi.stubEnv('QUAKESHELL_INSTALL_ROOT', installRoot);
      process.execPath = path.join(
        installRoot,
        'versions',
        '1.0.0-win32-x64',
        'quakeshell-win32-x64',
        'quakeshell.exe',
      );

      const installChild = createMockChildProcess();
      const restartChild = createMockChildProcess();
      mockSpawn
        .mockImplementationOnce(() => installChild as any)
        .mockImplementationOnce(() => restartChild as any);

      const restartHandler = vi.fn();
      setUpdateRestartHandler(restartHandler);

      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '2.0.0' }),
      } as Response);

      await checkForUpdates(false);

      const availableNotification = MockNotification.mock.instances[MockNotification.mock.instances.length - 1] as any;
      const availableClick = availableNotification.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'click',
      )![1] as Function;

      availableClick();

      expect(mockSpawn).toHaveBeenNthCalledWith(
        1,
        'cmd.exe',
        ['/d', '/s', '/c', 'npm install -g quakeshell@2.0.0'],
        expect.objectContaining({
          stdio: 'ignore',
          windowsHide: true,
        }),
      );

      const updatedExecutablePath = path.join(
        installRoot,
        'versions',
        '2.0.0-win32-x64',
        'quakeshell-win32-x64',
        'quakeshell.exe',
      );
      fs.mkdirSync(path.dirname(updatedExecutablePath), { recursive: true });
      fs.writeFileSync(updatedExecutablePath, 'exe');

      installChild.emit('exit', 0);

      await vi.waitFor(() => {
        expect(MockNotification).toHaveBeenCalledWith({
          title: 'QuakeShell',
          body: 'QuakeShell v2.0.0 installed. Click to restart.',
        });
      });

      const restartNotification = MockNotification.mock.instances[MockNotification.mock.instances.length - 1] as any;
      const restartClick = restartNotification.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'click',
      )![1] as Function;

      restartClick();

      expect(mockSpawn).toHaveBeenNthCalledWith(
        2,
        updatedExecutablePath,
        [],
        expect.objectContaining({
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        }),
      );

      restartChild.emit('spawn');

      await vi.waitFor(() => {
        expect(restartHandler).toHaveBeenCalled();
      });
    });

    it('does not notify on periodic check when same version', async () => {
      mockGetVersion.mockReturnValue('1.0.0');
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '1.0.0' }),
      } as Response);

      const result = await checkForUpdates(false);

      expect(result.updateAvailable).toBe(false);
      expect(MockNotification).not.toHaveBeenCalled();
    });

    it('shows "up to date" notification on manual check when same version', async () => {
      mockGetVersion.mockReturnValue('1.0.0');
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '1.0.0' }),
      } as Response);

      const result = await checkForUpdates(true);

      expect(result.updateAvailable).toBe(false);
      expect(MockNotification).toHaveBeenCalledWith({
        title: 'QuakeShell',
        body: 'QuakeShell is up to date',
      });
    });

    it('handles network error gracefully — no notification, no throw', async () => {
      mockGetVersion.mockReturnValue('1.0.0');
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      const result = await checkForUpdates(false);

      expect(result.updateAvailable).toBe(false);
      expect(result.error).toBe('Network error');
      expect(MockNotification).not.toHaveBeenCalled();
    });

    it('handles HTTP error gracefully', async () => {
      mockGetVersion.mockReturnValue('1.0.0');
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const result = await checkForUpdates(false);

      expect(result.updateAvailable).toBe(false);
      expect(result.error).toBe('HTTP 500');
    });

    it('detects minor version update correctly', async () => {
      mockGetVersion.mockReturnValue('1.2.0');
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '1.3.0' }),
      } as Response);

      const result = await checkForUpdates(false);
      expect(result.updateAvailable).toBe(true);
    });

    it('detects patch version update correctly', async () => {
      mockGetVersion.mockReturnValue('1.2.3');
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '1.2.4' }),
      } as Response);

      const result = await checkForUpdates(false);
      expect(result.updateAvailable).toBe(true);
    });

    it('does not report update when current version is newer', async () => {
      mockGetVersion.mockReturnValue('2.0.0');
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '1.0.0' }),
      } as Response);

      const result = await checkForUpdates(false);
      expect(result.updateAvailable).toBe(false);
    });
  });
});
