import { globalShortcut } from 'electron';
import log from 'electron-log/main';

const logger = log.scope('hotkey-manager');

let registeredAccelerator: string | null = null;
let toggleCallback: (() => void) | null = null;
let conflictState: string | null = null;

export function registerHotkey(
  accelerator: string,
  callback: () => void,
): boolean {
  toggleCallback = callback;
  try {
    const success = globalShortcut.register(accelerator, callback);
    if (success) {
      registeredAccelerator = accelerator;
      conflictState = null;
      logger.info(`Global hotkey registered: ${accelerator}`);
      return true;
    } else {
      logger.warn(
        `Global hotkey registration returned false: ${accelerator}`,
      );
      conflictState = accelerator;
      return false;
    }
  } catch (error) {
    logger.warn(`Failed to register global hotkey "${accelerator}":`, error);
    conflictState = accelerator;
    return false;
  }
}

export function reregister(oldHotkey: string, newHotkey: string): boolean {
  // Unregister old key (safe to call even if not registered — no-op)
  try {
    globalShortcut.unregister(oldHotkey);
    logger.info(`Global hotkey unregistered: ${oldHotkey}`);
  } catch (error) {
    logger.warn(`Failed to unregister old hotkey "${oldHotkey}":`, error);
  }

  registeredAccelerator = null;
  conflictState = null;

  if (!toggleCallback) {
    logger.warn('Cannot re-register hotkey — no toggle callback stored');
    return false;
  }

  try {
    const success = globalShortcut.register(newHotkey, toggleCallback);
    if (success) {
      registeredAccelerator = newHotkey;
      conflictState = null;
      logger.info(`Hotkey registered: ${newHotkey}`);
      return true;
    } else {
      logger.warn(
        `Hotkey registration failed — conflict detected: ${newHotkey}`,
      );
      conflictState = newHotkey;
      return false;
    }
  } catch (error) {
    logger.warn(`Failed to register hotkey "${newHotkey}":`, error);
    conflictState = newHotkey;
    return false;
  }
}

export function unregisterHotkey(): void {
  if (registeredAccelerator) {
    try {
      globalShortcut.unregister(registeredAccelerator);
      logger.info(`Global hotkey unregistered: ${registeredAccelerator}`);
    } catch (error) {
      logger.warn('Failed to unregister hotkey:', error);
    }
    registeredAccelerator = null;
  }
}

export function unregisterAll(): void {
  try {
    globalShortcut.unregisterAll();
    registeredAccelerator = null;
    logger.info('All global hotkeys unregistered');
  } catch (error) {
    logger.warn('Failed to unregister all hotkeys:', error);
  }
}

export function getConflictState(): string | null {
  return conflictState;
}

export function getRegisteredAccelerator(): string | null {
  return registeredAccelerator;
}

/** @internal For test use only */
export function _reset(): void {
  registeredAccelerator = null;
  toggleCallback = null;
  conflictState = null;
}
