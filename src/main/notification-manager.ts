import { Notification, app, shell } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import log from 'electron-log/main';
import { APP_NAME } from '@shared/constants';
import type { PendingUpdatePayload } from '@shared/ipc-types';
import * as windowManager from './window-manager';

const logger = log.scope('notification-manager');
const updateLogger = log.scope('update-checker');

const UPDATE_FETCH_TIMEOUT = 10_000; // 10 seconds
const REGISTRY_URL = 'https://registry.npmjs.org/quakeshell/latest';
const RELEASES_URL = 'https://github.com/jatson/QuakeShell/releases';
const NPM_PACKAGE_NAME = 'quakeshell';
const WINDOWS_PLATFORM = 'win32';
const WINDOWS_ARCH = 'x64';
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

let pendingUpdateVersion: string | null = null;
let installingUpdateVersion: string | null = null;
let updateInstallPromise: Promise<void> | null = null;
let updateRestartHandler: (() => void) | null = null;
const pendingUpdateListeners = new Set<(payload: PendingUpdatePayload | null) => void>();

export interface NotificationOptions {
  title: string;
  body: string;
  onClick?: () => void;
  bypassSuppression?: boolean;
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string | null;
  error?: string;
}

export function setUpdateRestartHandler(handler: (() => void) | null): void {
  updateRestartHandler = handler;
}

function buildPendingUpdatePayload(version: string): PendingUpdatePayload {
  return {
    version,
    source: 'background-install',
  };
}

function emitPendingUpdateChanged(): void {
  const payload = getPendingUpdate();
  for (const listener of pendingUpdateListeners) {
    try {
      listener(payload);
    } catch (error) {
      updateLogger.warn(`Pending update listener failed: ${getErrorMessage(error)}`);
    }
  }
}

function setPendingUpdateVersion(version: string | null): void {
  if (pendingUpdateVersion === version) {
    return;
  }

  pendingUpdateVersion = version;
  emitPendingUpdateChanged();
}

export function getPendingUpdate(): PendingUpdatePayload | null {
  return pendingUpdateVersion ? buildPendingUpdatePayload(pendingUpdateVersion) : null;
}

export function onPendingUpdateChange(
  listener: (payload: PendingUpdatePayload | null) => void,
): () => void {
  pendingUpdateListeners.add(listener);
  return () => {
    pendingUpdateListeners.delete(listener);
  };
}

export function delayPendingUpdate(): PendingUpdatePayload | null {
  return getPendingUpdate();
}

function getInstallRoot(environment = process.env): string {
  return path.resolve(environment.QUAKESHELL_INSTALL_ROOT || path.join(os.homedir(), '.quakeshell', 'npm'));
}

function getVersionInstallDir(version: string, environment = process.env): string {
  return path.join(getInstallRoot(environment), 'versions', `${version}-${WINDOWS_PLATFORM}-${WINDOWS_ARCH}`);
}

function findExecutable(rootDirectory: string, executableName: string): string | null {
  if (!fs.existsSync(rootDirectory)) {
    return null;
  }

  const pendingDirectories = [rootDirectory];
  const targetName = executableName.toLowerCase();
  const visitedDirectories = new Set<string>();

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    if (!currentDirectory) {
      continue;
    }

    let realPath: string;
    try {
      realPath = (fs.realpathSync.native || fs.realpathSync)(currentDirectory);
    } catch {
      continue;
    }

    if (visitedDirectories.has(realPath)) {
      continue;
    }

    visitedDirectories.add(realPath);

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDirectory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        pendingDirectories.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.toLowerCase() === targetName) {
        return fullPath;
      }
    }
  }

  return null;
}

function getInstalledExecutable(version: string, environment = process.env): string | null {
  return findExecutable(
    getVersionInstallDir(version, environment),
    `${NPM_PACKAGE_NAME}.exe`,
  );
}

function getReleasePageUrl(version: string): string {
  return `${RELEASES_URL}/tag/v${version}`;
}

function isNpmManagedInstall(environment = process.env, executablePath = process.execPath): boolean {
  const versionsRoot = `${path.resolve(getInstallRoot(environment), 'versions').toLowerCase()}${path.sep}`;
  const normalizedExecutablePath = path.resolve(executablePath).toLowerCase();
  return normalizedExecutablePath.startsWith(versionsRoot);
}

function canAutoInstallUpdate(environment = process.env, executablePath = process.execPath): boolean {
  return process.platform === WINDOWS_PLATFORM && isNpmManagedInstall(environment, executablePath);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseSemver(version: string): [number, number, number] | null {
  if (!SEMVER_PATTERN.test(version)) {
    return null;
  }

  const [coreVersion] = version.split(/[+-]/, 1);
  const [major, minor, patch] = coreVersion.split('.', 3).map(Number);
  return [major, minor, patch];
}

function validateRegistryVersion(version: string | null): string {
  if (!version || parseSemver(version) === null) {
    throw new Error('Invalid response: invalid version field');
  }

  return version;
}

function runNpmInstall(version: string): Promise<void> {
  if (parseSemver(version) === null) {
    return Promise.reject(new Error(`Refusing to install invalid version: ${version}`));
  }

  const npmExecutable = process.platform === WINDOWS_PLATFORM ? 'npm.cmd' : 'npm';
  const child = spawn(npmExecutable, ['install', '-g', `${NPM_PACKAGE_NAME}@${version}`], {
    stdio: 'ignore',
    windowsHide: true,
  });

  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`npm install failed with exit code ${code ?? 'unknown'} for ${NPM_PACKAGE_NAME}@${version}`));
    });
  });
}

function launchDetachedExecutable(executablePath: string): Promise<void> {
  const child = spawn(executablePath, [], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });

  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('spawn', () => {
      try {
        child.unref();
      } catch {
        // Ignore unref failures after a successful spawn.
      }

      resolve();
    });
  });
}

async function restartIntoInstalledVersion(version: string): Promise<boolean> {
  const executablePath = getInstalledExecutable(version);

  if (!executablePath) {
    void shell.openExternal(getReleasePageUrl(version));
    return false;
  }

  try {
    await launchDetachedExecutable(executablePath);
    setPendingUpdateVersion(null);
    if (updateRestartHandler) {
      updateRestartHandler();
    } else {
      app.quit();
    }
    return true;
  } catch (error) {
    const message = getErrorMessage(error);
    updateLogger.warn(`Failed to relaunch ${APP_NAME} ${version}: ${message}`);
    void shell.openExternal(getReleasePageUrl(version));
    return false;
  }
}

export async function restartPendingUpdate(): Promise<boolean> {
  if (!pendingUpdateVersion) {
    return false;
  }

  return restartIntoInstalledVersion(pendingUpdateVersion);
}

async function installAvailableUpdate(latestVersion: string): Promise<void> {
  const validatedVersion = validateRegistryVersion(latestVersion);

  if (pendingUpdateVersion === validatedVersion) {
    return;
  }

  if (updateInstallPromise) {
    if (installingUpdateVersion && installingUpdateVersion !== validatedVersion) {
      updateLogger.info(
        `Update install already running for ${installingUpdateVersion}; deferring ${validatedVersion}`,
      );
    }

    return updateInstallPromise;
  }

  installingUpdateVersion = validatedVersion;
  updateInstallPromise = runNpmInstall(validatedVersion)
    .then(() => {
      setPendingUpdateVersion(validatedVersion);
      updateLogger.info(`Update installed: ${validatedVersion}`);
    })
    .catch((error) => {
      if (pendingUpdateVersion === validatedVersion) {
        setPendingUpdateVersion(null);
      }
      const message = getErrorMessage(error);
      updateLogger.warn(`Automatic update failed: ${message}`);
      send({
        title: APP_NAME,
        body: `Automatic update failed. Click to open ${APP_NAME} v${validatedVersion}.`,
        onClick: () => {
          void shell.openExternal(getReleasePageUrl(validatedVersion));
        },
        bypassSuppression: true,
      });
    })
    .finally(() => {
      installingUpdateVersion = null;
      updateInstallPromise = null;
    });

  return updateInstallPromise;
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
  if (!options.bypassSuppression && isNotificationSuppressed()) {
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
  const c = parseSemver(current);
  const l = parseSemver(latest);
  if (!c || !l) {
    return false;
  }

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
    const latestVersion = validateRegistryVersion(data.version ?? null);

    const updateAvailable = isNewerVersion(currentVersion, latestVersion);

    if (updateAvailable) {
      if (pendingUpdateVersion === latestVersion) {
        updateLogger.info(`Update already installed and waiting for restart: ${latestVersion}`);
      } else if (canAutoInstallUpdate()) {
        void installAvailableUpdate(latestVersion);
      } else {
        send({
          title: APP_NAME,
          body: `${APP_NAME} v${latestVersion} available. Click to download.`,
          onClick: () => {
            void shell.openExternal(getReleasePageUrl(latestVersion));
          },
          bypassSuppression: true,
        });
      }
      updateLogger.info(`Update available: ${currentVersion} → ${latestVersion}`);
    } else if (manual) {
      send({
        title: APP_NAME,
        body: `${APP_NAME} is up to date`,
        bypassSuppression: true,
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

export function _reset(): void {
  pendingUpdateVersion = null;
  installingUpdateVersion = null;
  updateInstallPromise = null;
  updateRestartHandler = null;
  pendingUpdateListeners.clear();
}
