import { Tray, Menu, app, dialog, nativeTheme, nativeImage, shell } from 'electron';
import path from 'node:path';
import log from 'electron-log/main';
import * as notificationManager from './notification-manager';

const logger = log.scope('tray-manager');

let tray: Tray | null = null;
let toggleCallback: (() => void) | null = null;
let getHotkeyLabel: (() => string) | null = null;
let getConfigPathFn: (() => string) | null = null;
let shutdownCallback: (() => void) | null = null;

function getIconPath(): string {
  const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  return path.join(__dirname, `../../assets/tray/icon-${theme}.ico`);
}

function buildContextMenu(): Menu {
  const hotkeyLabel = getHotkeyLabel?.() ?? '';
  return Menu.buildFromTemplate([
    {
      label: `Toggle Terminal\t${hotkeyLabel}`,
      click: () => toggleCallback?.(),
    },
    { type: 'separator' },
    {
      label: 'Edit Settings',
      click: () => {
        const configPath = getConfigPathFn?.();
        if (configPath) {
          shell.openPath(configPath);
        }
      },
    },
    {
      label: 'Check for Updates',
      click: () => {
        notificationManager.checkForUpdates(true);
      },
    },
    { type: 'separator' },
    {
      label: 'About QuakeShell',
      click: () => {
        void dialog.showMessageBox({
          type: 'info',
          title: 'About QuakeShell',
          message: 'QuakeShell',
          detail: `Version ${app.getVersion()}`,
          buttons: ['OK'],
          noLink: true,
        });
      },
    },
    {
      label: 'Quit',
      click: () => shutdownCallback?.(),
    },
  ]);
}

export interface TrayOptions {
  onToggle: () => void;
  getHotkey: () => string;
  getConfigPath: () => string;
  onQuit: () => void;
}

export function createTray(options: TrayOptions): Tray;
export function createTray(onToggle: () => void): Tray;
export function createTray(optionsOrToggle: TrayOptions | (() => void)): Tray {
  if (typeof optionsOrToggle === 'function') {
    toggleCallback = optionsOrToggle;
  } else {
    toggleCallback = optionsOrToggle.onToggle;
    getHotkeyLabel = optionsOrToggle.getHotkey;
    getConfigPathFn = optionsOrToggle.getConfigPath;
    shutdownCallback = optionsOrToggle.onQuit;
  }

  const iconPath = getIconPath();
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip('QuakeShell');

  tray.setContextMenu(buildContextMenu());

  tray.on('click', () => {
    toggleCallback?.();
  });

  // Swap icon on theme change
  nativeTheme.on('updated', () => {
    if (tray) {
      const newIconPath = getIconPath();
      tray.setImage(nativeImage.createFromPath(newIconPath));
      logger.info(`Tray icon updated for ${nativeTheme.shouldUseDarkColors ? 'dark' : 'light'} theme`);
    }
  });

  logger.info('Tray created');
  return tray;
}

/** Rebuild the context menu (e.g. when hotkey changes) */
export function rebuildContextMenu(): void {
  if (tray) {
    tray.setContextMenu(buildContextMenu());
  }
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
    logger.info('Tray destroyed');
  }
}
