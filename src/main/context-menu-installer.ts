import { execSync } from 'node:child_process';
import path from 'node:path';
import log from 'electron-log/main';

const logger = log.scope('context-menu');

const DIRECTORY_KEY = 'HKCU\\Software\\Classes\\Directory\\shell\\QuakeShell';
const BACKGROUND_KEY = 'HKCU\\Software\\Classes\\Directory\\Background\\shell\\QuakeShell';

export interface ContextMenuLaunchTarget {
  executablePath: string;
  appPath?: string;
}

function containsControlCharacters(value: string): boolean {
  for (const char of value) {
    if (char.charCodeAt(0) <= 31) {
      return true;
    }
  }

  return false;
}

function sanitizePath(pathValue: string, fieldName: 'appPath' | 'executablePath'): string {
  if (containsControlCharacters(pathValue)) {
    throw new Error(`context-menu-installer: ${fieldName} contains illegal characters`);
  }

  return path.resolve(pathValue);
}

function sanitizeLaunchTarget(target: ContextMenuLaunchTarget): ContextMenuLaunchTarget {
  const executablePath = sanitizePath(target.executablePath, 'executablePath');
  if (!executablePath.toLowerCase().endsWith('.exe')) {
    throw new Error('context-menu-installer: executablePath must end with .exe');
  }

  const appPath = target.appPath
    ? sanitizePath(target.appPath, 'appPath')
    : undefined;

  return {
    executablePath,
    appPath,
  };
}

function quoteRegistryPath(pathValue: string): string {
  return `\\"${pathValue}\\"`;
}

function buildCommandValue(target: ContextMenuLaunchTarget, cwdToken: '%1' | '%V'): string {
  const launchParts = [quoteRegistryPath(target.executablePath)];

  if (target.appPath) {
    launchParts.push(quoteRegistryPath(target.appPath));
    launchParts.push('--');
  }

  launchParts.push(`--cwd \\"${cwdToken}\\"`);
  return launchParts.join(' ');
}

function buildRegisterCommands(
  registryKey: string,
  target: ContextMenuLaunchTarget,
  cwdToken: '%1' | '%V',
): string[] {
  const quotedExePath = quoteRegistryPath(target.executablePath);
  const commandValue = buildCommandValue(target, cwdToken);

  return [
    `reg add "${registryKey}" /ve /d "Open QuakeShell here" /f`,
    `reg add "${registryKey}" /v "Icon" /d "${quotedExePath}" /f`,
    `reg add "${registryKey}\\command" /f`,
    `reg add "${registryKey}\\command" /ve /d "${commandValue}" /f`,
  ];
}

function runCommands(commands: string[]): void {
  for (const command of commands) {
    execSync(command, { stdio: 'pipe' });
  }
}

export function register(executablePath: string, appPath?: string): void {
  const launchTarget = sanitizeLaunchTarget({ executablePath, appPath });
  const commands = [
    ...buildRegisterCommands(DIRECTORY_KEY, launchTarget, '%1'),
    ...buildRegisterCommands(BACKGROUND_KEY, launchTarget, '%V'),
  ];

  try {
    runCommands(commands);
    logger.info('Context menu registered');
  } catch (error) {
    logger.error('Failed to register context menu', error);
    throw error;
  }
}

export function deregister(): void {
  const commands = [
    `reg delete "${DIRECTORY_KEY}" /f`,
    `reg delete "${BACKGROUND_KEY}" /f`,
  ];

  try {
    runCommands(commands);
    logger.info('Context menu deregistered');
  } catch (error) {
    logger.error('Failed to deregister context menu', error);
    throw error;
  }
}

export function isRegistered(): boolean {
  try {
    execSync(`reg query "${DIRECTORY_KEY}" /ve`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}