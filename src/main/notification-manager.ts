import { Notification, app } from 'electron';
import log from 'electron-log/main';
import * as windowManager from './window-manager';

const logger = log.scope('notification-manager');
const updateLogger = log.scope('update-checker');

const UPDATE_FETCH_TIMEOUT = 10_000; // 10 seconds
const REGISTRY_URL = 'https://registry.npmjs.org/quakeshell/latest';

export interface NotificationOptions {
  title: string;
  body: string;
  onClick?: () => void;
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string | null;
  error?: string;
}

/**
 * Returns true if the terminal is visible and focused — notifications should be suppressed.
 */
export function isNotificationSuppressed(): boolean {
  if (!windowManager.isVisible()) return false;
  const win = windowManager.getWindow();
  return win !== null && !win.isDestroyed() && win.isFocused();
}

/**
 * Send a Windows toast notification.
 * Suppressed if the terminal is visible and focused (AC #3).
 */
export function send(options: NotificationOptions): void {
  if (isNotificationSuppressed()) {
    logger.info('Notification suppressed — terminal is visible and focused');
    return;
  }

  try {
    const notification = new Notification({
      title: options.title,
      body: options.body,
    });

    notification.on('click', () => {
      if (options.onClick) {
        options.onClick();
      } else {
        windowManager.toggle();
      }
    });

    notification.show();
    logger.info(`Notification sent: ${options.title} — ${options.body}`);
  } catch (error) {
    logger.error('Failed to send notification:', error);
  }
}

/**
 * Compare two semver strings (major.minor.patch).
 * Returns true if b is newer than a.
 */
function isNewerVersion(current: string, latest: string): boolean {
  const c = current.split('.').map(Number);
  const l = latest.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const cv = c[i] || 0;
    const lv = l[i] || 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

/**
 * Check npm registry for a newer version of QuakeShell.
 * @param manual - true when triggered by user (shows "up to date" message); false for periodic check
 */
export async function checkForUpdates(manual = false): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPDATE_FETCH_TIMEOUT);

    const response = await fetch(REGISTRY_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as { version?: string };
    const latestVersion = data.version ?? null;

    if (!latestVersion) {
      throw new Error('Invalid response: no version field');
    }

    const updateAvailable = isNewerVersion(currentVersion, latestVersion);

    if (updateAvailable) {
      send({
        title: 'QuakeShell',
        body: `QuakeShell v${latestVersion} available. Update now?`,
      });
      updateLogger.info(`Update available: ${currentVersion} → ${latestVersion}`);
    } else if (manual) {
      send({
        title: 'QuakeShell',
        body: 'QuakeShell is up to date',
      });
      updateLogger.info(`Up to date: ${currentVersion}`);
    } else {
      updateLogger.verbose(`No update: ${currentVersion} is current`);
    }

    return { updateAvailable, currentVersion, latestVersion };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateLogger.verbose(`Update check failed: ${message}`);
    return { updateAvailable: false, currentVersion, latestVersion: null, error: message };
  }
}
