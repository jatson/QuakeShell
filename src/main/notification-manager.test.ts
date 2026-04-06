import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { MockNotification, mockGetVersion } = vi.hoisted(() => ({
  MockNotification: vi.fn(function (this: any) {
    this.on = vi.fn();
    this.show = vi.fn();
  }),
  mockGetVersion: vi.fn(() => '1.0.0'),
}));

vi.mock('electron', () => ({
  Notification: MockNotification,
  app: {
    getVersion: mockGetVersion,
  },
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
} from './notification-manager';

describe('main/notification-manager', () => {
  beforeEach(() => {
    MockNotification.mockClear();
    // Re-apply constructor body after mockClear (which preserves implementation)
    // but NOT vi.restoreAllMocks() which would strip the vi.hoisted implementation
    MockNotification.mockImplementation(function (this: any) {
      this.on = vi.fn();
      this.show = vi.fn();
    });
    vi.mocked(windowManager.isVisible).mockReturnValue(false);
    vi.mocked(windowManager.getWindow).mockReturnValue({
      isDestroyed: vi.fn(() => false),
      isFocused: vi.fn(() => false),
    } as any);
    vi.mocked(windowManager.toggle).mockClear();
    mockGetVersion.mockReturnValue('1.0.0');
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
        body: 'QuakeShell v2.0.0 available. Update now?',
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
