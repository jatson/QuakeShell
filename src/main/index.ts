import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import log from 'electron-log/main';
import { APP_NAME } from '@shared/constants';
import { createConfigStore } from './config-store';
import { registerIpcHandlers } from './ipc-handlers';
import * as windowManager from './window-manager';
import * as trayManager from './tray-manager';
import * as hotkeyManager from './hotkey-manager';
import * as terminalManager from './terminal-manager';
import * as tabManager from './tab-manager';
import { themeEngine } from './theme-engine';
import {
  initAppLifecycle,
  applyAutostart,
  registerAutostartConfigHandler,
  logMilestone,
  gracefulShutdown,
  startPeriodicUpdateCheck,
  handleSquirrelLifecycle,
  handleStartupCwd,
  flushPendingCwdLaunches,
  parseCwdArg,
} from './app-lifecycle';

// Configure electron-log
log.transports.file.resolvePathFn = () =>
  path.join(app.getPath('userData'), 'logs', 'main.log');
log.initialize();

// Prevent EPIPE crashes when stdout/stderr pipes close (common in Electron + Forge)
process.stdout?.on?.('error', () => {});
process.stderr?.on?.('error', () => {});

const logger = log.scope('main');

// Handle install/update/uninstall hooks before app startup.
if (!handleSquirrelLifecycle()) {
  // Single instance lock — must be acquired before app.whenReady()
  const gotLock = initAppLifecycle();
  if (!gotLock) {
    // Second instance — quit handled inside initAppLifecycle
    // app.quit() already called; nothing more to do
  } else {
  const startupTime = performance.now();
  const hasStartupCwd = parseCwdArg(process.argv) !== null;

  app.on('ready', () => {
    logger.info(`${APP_NAME} starting up`);

    // 1. Initialize config store
    const configStore = createConfigStore();
    logMilestone('Config store created', startupTime);

    themeEngine.init(configStore);
    logMilestone('Theme engine initialized', startupTime);

    // Initialize terminal manager with configured default shell
    terminalManager.setDefaultShell(configStore.get('defaultShell'));

    // 2. Apply autostart setting from config
    applyAutostart(configStore.get('autostart'));
    registerAutostartConfigHandler(configStore);

    // 3. Create tray icon with full context menu
    trayManager.createTray({
      onToggle: () => windowManager.toggle(),
      getHotkey: () => configStore.get('hotkey'),
      getConfigPath: () => configStore.getConfigPath(),
      onQuit: () => gracefulShutdown(),
    });
    logMilestone('Tray created', startupTime);

    // 4. Create BrowserWindow via window manager (show: false — pre-created in background)
    const mainWindow = windowManager.createWindow(configStore);
    logMilestone('Window pre-created', startupTime);

    // 5. Initialize TabManager (creates default tab with PTY)
    tabManager.init(mainWindow, configStore).then(() => {
      logMilestone('TabManager initialized', startupTime);
      handleStartupCwd(process.argv);
      flushPendingCwdLaunches();
    }).catch((error) => {
      logger.warn('Failed to initialize TabManager — will retry on first toggle:', error);
    });

    // 6. Setup focus-fade if enabled in config
    if (configStore.get('focusFade')) {
      windowManager.setupFocusFade();
    }

    // 7. Register global hotkey
    const hotkey = configStore.get('hotkey');
    const registered = hotkeyManager.registerHotkey(hotkey, () =>
      windowManager.toggle(),
    );
    if (!registered) {
      logger.warn(
        `Hotkey "${hotkey}" registration failed — tray icon is available as fallback`,
      );
    }
    logMilestone('Hotkey registered', startupTime);

    // 8. Register IPC handlers (including terminal spawn)
    registerIpcHandlers(configStore, mainWindow);
    logMilestone('Startup complete — tray ready', startupTime);

    // 9. Auto-show terminal on first run for onboarding overlay
    if (configStore.get('firstRun') && !hasStartupCwd) {
      mainWindow.webContents.once('did-finish-load', () => {
        windowManager.show();
        logMilestone('First-run auto-show', startupTime);
      });
    }

    // 10. Schedule periodic update checks (5min initial delay, then every 24h)
    startPeriodicUpdateCheck();
  });
  }
}

// Prevent app from quitting when all windows are hidden (tray-resident)
app.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});

// Clean up global shortcuts on quit
app.on('will-quit', () => {
  hotkeyManager.unregisterAll();
});

// Mark quitting so window-manager close interceptor allows it
app.on('before-quit', () => {
  windowManager.setQuitting(true);
  themeEngine.destroy();
});
