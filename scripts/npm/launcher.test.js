const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createInstallManifest,
  getVersionInstallDir,
  readPackageMetadata,
  writeInstallManifest,
} = require('./distribution');
const {
  createLaunchError,
  isSpawnUnknownError,
  launch,
  resolveExecutablePath,
} = require('./launcher');

function createTempDirectory(prefix = 'quakeshell-launcher-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createTempPackage() {
  const packageRoot = createTempDirectory('quakeshell-package-');
  fs.writeFileSync(
    path.join(packageRoot, 'package.json'),
    `${JSON.stringify({
      name: 'quakeshell',
      version: '9.9.9',
      repository: {
        type: 'git',
        url: 'https://github.com/jatson/QuakeShell.git',
      },
    }, null, 2)}\n`,
    'utf8',
  );
  return packageRoot;
}

function removeDirectory(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true });
}

describe('scripts/npm/launcher', () => {
  const temporaryPaths = [];

  afterEach(() => {
    while (temporaryPaths.length > 0) {
      removeDirectory(temporaryPaths.pop());
    }
  });

  function createContext() {
    const packageRoot = createTempPackage();
    const installRoot = createTempDirectory('quakeshell-install-');
    const metadata = readPackageMetadata(packageRoot);
    temporaryPaths.push(packageRoot, installRoot);

    return {
      environment: {
        QUAKESHELL_INSTALL_ROOT: installRoot,
      },
      metadata,
      packageRoot,
    };
  }

  function provisionInstallation(context) {
    const versionDirectory = getVersionInstallDir(context.metadata, context.environment, 'win32', 'x64');
    const executablePath = path.join(versionDirectory, 'quakeshell.exe');
    const manifest = createInstallManifest(context.metadata, executablePath, null, 'cache', 'win32', 'x64');

    fs.mkdirSync(versionDirectory, { recursive: true });
    fs.writeFileSync(executablePath, 'exe', 'utf8');
    writeInstallManifest(context.metadata, manifest, context.environment, 'win32', 'x64');

    return executablePath;
  }

  it('resolves the provisioned executable from the install manifest', () => {
    const context = createContext();
    const executablePath = provisionInstallation(context);
    const powerShellRunner = vi.fn(() => ({ status: 0, stdout: '9.9.9\n', stderr: '' }));

    expect(resolveExecutablePath({
      ...context,
      arch: 'x64',
      platform: 'win32',
      powerShellRunner,
    })).toBe(executablePath);
  });

  it('spawns the provisioned executable with forwarded args', async () => {
    const context = createContext();
    const executablePath = provisionInstallation(context);
    const powerShellRunner = vi.fn(() => ({ status: 0, stdout: '9.9.9\n', stderr: '' }));
    const unref = vi.fn();
    const once = vi.fn((eventName, handler) => {
      if (eventName === 'spawn') {
        handler();
      }
      return child;
    });
    const child = { once, unref };
    const spawnImpl = vi.fn(() => child);

    const result = await launch({
      ...context,
      args: ['--cwd', 'C:\\Work'],
      arch: 'x64',
      cwd: 'C:\\Projects\\QuakeShell',
      platform: 'win32',
      powerShellRunner,
      spawnImpl,
    });

    expect(spawnImpl).toHaveBeenCalledWith(executablePath, ['--cwd', 'C:\\Work'], {
      cwd: 'C:\\Projects\\QuakeShell',
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    expect(unref).toHaveBeenCalled();
    expect(result.executablePath).toBe(executablePath);
  });

  it('rejects when the child process emits an asynchronous launch error', async () => {
    const context = createContext();
    const executablePath = provisionInstallation(context);
    const powerShellRunner = vi.fn(() => ({ status: 0, stdout: '9.9.9\n', stderr: '' }));
    const launchError = new Error('spawn EPERM');
    const once = vi.fn((eventName, handler) => {
      if (eventName === 'error') {
        handler(launchError);
      }
      return child;
    });
    const child = { once, unref: vi.fn() };
    const spawnImpl = vi.fn(() => child);

    await expect(launch({
      ...context,
      arch: 'x64',
      platform: 'win32',
      powerShellRunner,
      spawnImpl,
    })).rejects.toThrow('spawn EPERM');

    expect(spawnImpl).toHaveBeenCalledWith(executablePath, [], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
  });

  it('rejects with a clear Windows policy message when spawn throws synchronously with UNKNOWN', async () => {
    const context = createContext();
    const executablePath = provisionInstallation(context);
    const powerShellRunner = vi.fn(() => ({ status: 0, stdout: '9.9.9\n', stderr: '' }));
    const launchError = Object.assign(new Error('spawn UNKNOWN'), {
      code: 'UNKNOWN',
      syscall: 'spawn',
    });
    const spawnImpl = vi.fn(() => {
      throw launchError;
    });

    await expect(launch({
      ...context,
      arch: 'x64',
      platform: 'win32',
      powerShellRunner,
      spawnImpl,
    })).rejects.toThrow('Application Control, AppLocker, or WDAC policy');

    expect(spawnImpl).toHaveBeenCalledWith(executablePath, [], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
  });

  it('wraps asynchronous Windows UNKNOWN spawn errors with the same policy guidance', async () => {
    const context = createContext();
    const executablePath = provisionInstallation(context);
    const powerShellRunner = vi.fn(() => ({ status: 0, stdout: '9.9.9\n', stderr: '' }));
    const launchError = Object.assign(new Error('spawn UNKNOWN'), {
      code: 'UNKNOWN',
      syscall: 'spawn',
    });
    const once = vi.fn((eventName, handler) => {
      if (eventName === 'error') {
        handler(launchError);
      }
      return child;
    });
    const child = { once, unref: vi.fn() };
    const spawnImpl = vi.fn(() => child);

    await expect(launch({
      ...context,
      arch: 'x64',
      platform: 'win32',
      powerShellRunner,
      spawnImpl,
    })).rejects.toThrow('Application Control, AppLocker, or WDAC policy');
  });

  it('throws a clear error when nothing is provisioned', () => {
    const context = createContext();

    expect(() => resolveExecutablePath({
      ...context,
      arch: 'x64',
      platform: 'win32',
    })).toThrow('QuakeShell is not provisioned');
  });

  it('rejects instead of throwing when executable resolution fails during launch', async () => {
    const context = createContext();

    await expect(launch({
      ...context,
      arch: 'x64',
      platform: 'win32',
    })).rejects.toThrow('QuakeShell is not provisioned');
  });

  it('rejects cached executables whose embedded version does not match the package version', () => {
    const context = createContext();
    const versionDirectory = getVersionInstallDir(context.metadata, context.environment, 'win32', 'x64');
    const executablePath = path.join(versionDirectory, 'quakeshell.exe');
    const powerShellRunner = vi.fn(() => ({ status: 0, stdout: '9.9.8\n', stderr: '' }));

    fs.mkdirSync(versionDirectory, { recursive: true });
    fs.writeFileSync(executablePath, 'exe', 'utf8');

    expect(() => resolveExecutablePath({
      ...context,
      arch: 'x64',
      platform: 'win32',
      powerShellRunner,
    })).toThrow('does not match package version 9.9.9');
  });

  it('rejects manual override executables whose embedded version does not match the package version', () => {
    const context = createContext();
    const manualExecutablePath = path.join(createTempDirectory('quakeshell-manual-'), 'quakeshell.exe');
    const powerShellRunner = vi.fn(() => ({ status: 0, stdout: '9.9.8\n', stderr: '' }));

    temporaryPaths.push(path.dirname(manualExecutablePath));
    fs.writeFileSync(manualExecutablePath, 'exe', 'utf8');

    expect(() => resolveExecutablePath({
      ...context,
      arch: 'x64',
      environment: {
        ...context.environment,
        QUAKESHELL_BINARY_PATH: manualExecutablePath,
      },
      platform: 'win32',
      powerShellRunner,
    })).toThrow('does not match package version 9.9.9');
  });

  it('rejects manifest-backed executables whose embedded version does not match the package version', () => {
    const context = createContext();
    provisionInstallation(context);
    const powerShellRunner = vi.fn(() => ({ status: 0, stdout: '9.9.8\n', stderr: '' }));

    expect(() => resolveExecutablePath({
      ...context,
      arch: 'x64',
      platform: 'win32',
      powerShellRunner,
    })).toThrow('does not match package version 9.9.9');
  });

  it('rejects non-executable manual override paths', () => {
    const context = createContext();
    const manualFile = path.join(createTempDirectory('quakeshell-manual-'), 'quakeshell.txt');

    temporaryPaths.push(path.dirname(manualFile));
    fs.writeFileSync(manualFile, 'not an exe', 'utf8');

    expect(() => resolveExecutablePath({
      ...context,
      arch: 'x64',
      environment: {
        ...context.environment,
        QUAKESHELL_BINARY_PATH: manualFile,
      },
      platform: 'win32',
    })).toThrow('must point to an existing .exe file');
  });

  it('rejects manual override directories even when they end with .exe', () => {
    const context = createContext();
    const manualDirectory = path.join(createTempDirectory('quakeshell-manual-'), 'quakeshell.exe');

    temporaryPaths.push(path.dirname(manualDirectory));
    fs.mkdirSync(manualDirectory, { recursive: true });

    expect(() => resolveExecutablePath({
      ...context,
      arch: 'x64',
      environment: {
        ...context.environment,
        QUAKESHELL_BINARY_PATH: manualDirectory,
      },
      platform: 'win32',
    })).toThrow('must point to an existing .exe file');
  });

  it('recognizes Windows UNKNOWN spawn errors', () => {
    expect(isSpawnUnknownError({ code: 'UNKNOWN', syscall: 'spawn' })).toBe(true);
    expect(isSpawnUnknownError({ code: 'ENOENT', syscall: 'spawn' })).toBe(false);
    expect(isSpawnUnknownError(null)).toBe(false);
  });

  it('formats Windows UNKNOWN spawn errors with actionable guidance', () => {
    const launchError = Object.assign(new Error('spawn UNKNOWN'), {
      code: 'UNKNOWN',
      syscall: 'spawn',
    });

    expect(createLaunchError(launchError, 'C:/Users/backb/.quakeshell/quakeshell.exe', 'win32').message)
      .toContain('Application Control, AppLocker, or WDAC policy');
    expect(createLaunchError(new Error('spawn EPERM'), 'C:/temp/quakeshell.exe', 'win32').message)
      .toBe('spawn EPERM');
  });

  it('still resolves when child.unref throws after spawn', async () => {
    const context = createContext();
    const executablePath = provisionInstallation(context);
    const powerShellRunner = vi.fn(() => ({ status: 0, stdout: '9.9.9\n', stderr: '' }));
    const once = vi.fn((eventName, handler) => {
      if (eventName === 'spawn') {
        handler();
      }
      return child;
    });
    const child = {
      once,
      unref: vi.fn(() => {
        throw new Error('unref failed');
      }),
    };
    const spawnImpl = vi.fn(() => child);

    await expect(launch({
      ...context,
      arch: 'x64',
      platform: 'win32',
      powerShellRunner,
      spawnImpl,
    })).resolves.toMatchObject({ executablePath, args: [] });
  });
});