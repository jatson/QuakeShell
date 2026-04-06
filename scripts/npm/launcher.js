#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const { ensureExecutableVersion } = require('./postinstall');

const {
  MANUAL_BINARY_ENV,
  findExecutable,
  findPackagedExecutable,
  getExecutableName,
  getManualBinaryPath,
  getVersionInstallDir,
  isInstallManifestValid,
  isSourceCheckout,
  readInstallManifest,
  readPackageMetadata,
  resolveRuntimeTarget,
  resolvePackageRoot,
} = require('./distribution');

function isSpawnUnknownError(error) {
  return Boolean(
    error
      && typeof error === 'object'
      && error.code === 'UNKNOWN'
      && error.syscall === 'spawn',
  );
}

function createLaunchError(error, executablePath, platform = process.platform) {
  if (platform === 'win32' && isSpawnUnknownError(error)) {
    return new Error(
      `Windows blocked launching QuakeShell from ${executablePath}. This often indicates an Application Control, AppLocker, or WDAC policy blocking the unsigned executable. Allow the file or use a signed release. Original error: ${error.message}`,
      { cause: error },
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

function resolveExecutablePath(options = {}) {
  const packageRoot = options.packageRoot || resolvePackageRoot();
  const environment = options.environment || process.env;
  const powerShellRunner = options.powerShellRunner || spawnSync;
  const runtimeTarget = options.runtimeTarget || resolveRuntimeTarget({
    environment,
    platform: options.platform || process.platform,
    arch: options.arch || process.arch,
  });
  const platform = runtimeTarget.platform;
  const arch = runtimeTarget.arch;
  const metadata = options.metadata || readPackageMetadata(packageRoot);

  const manualBinaryPath = getManualBinaryPath(environment);
  if (manualBinaryPath) {
    if (!fs.existsSync(manualBinaryPath)) {
      throw new Error(`Configured ${MANUAL_BINARY_ENV} does not exist: ${manualBinaryPath}`);
    }

    const manualBinaryStat = fs.statSync(manualBinaryPath);
    if (!manualBinaryStat.isFile() || path.extname(manualBinaryPath).toLowerCase() !== '.exe') {
      throw new Error(`Configured ${MANUAL_BINARY_ENV} must point to an existing .exe file: ${manualBinaryPath}`);
    }

    ensureExecutableVersion(manualBinaryPath, metadata.version, powerShellRunner);

    return manualBinaryPath;
  }

  const manifest = readInstallManifest(metadata, environment, platform, arch);
  let manifestExecutableError = null;
  if (isInstallManifestValid(manifest)) {
    try {
      ensureExecutableVersion(manifest.executablePath, metadata.version, powerShellRunner);
      return manifest.executablePath;
    } catch (error) {
      manifestExecutableError = error;
    }
  }

  const cachedExecutable = findExecutable(
    getVersionInstallDir(metadata, environment, platform, arch),
    getExecutableName(metadata),
  );
  let cachedExecutableError = null;
  if (cachedExecutable) {
    try {
      ensureExecutableVersion(cachedExecutable, metadata.version, powerShellRunner);
      return cachedExecutable;
    } catch (error) {
      cachedExecutableError = error;
    }
  }

  if (isSourceCheckout(packageRoot)) {
    const packagedExecutable = findPackagedExecutable(packageRoot, metadata);
    if (packagedExecutable) {
      return packagedExecutable;
    }
  }

  if (manifestExecutableError) {
    throw manifestExecutableError;
  }

  if (cachedExecutableError) {
    throw cachedExecutableError;
  }

  throw new Error(
    'QuakeShell is not provisioned. Reinstall with `npm install -g quakeshell` or set QUAKESHELL_BINARY_PATH to an existing .exe.',
  );
}

function launch(options = {}) {
  const spawnImpl = options.spawnImpl || spawn;
  const platform = options.platform || process.platform;
  let executablePath;

  try {
    executablePath = options.executablePath || resolveExecutablePath(options);
  } catch (error) {
    return Promise.reject(createLaunchError(error, options.executablePath || 'QuakeShell', platform));
  }

  const args = options.args || process.argv.slice(2);

  let child;
  try {
    child = spawnImpl(executablePath, args, {
      cwd: options.cwd || process.cwd(),
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
  } catch (error) {
    return Promise.reject(createLaunchError(error, executablePath, platform));
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const settle = (callback, value) => {
      if (settled) {
        return;
      }

      settled = true;
      callback(value);
    };

    if (child && typeof child.once === 'function') {
      child.once('error', (error) => {
        settle(reject, createLaunchError(error, executablePath, platform));
      });
      child.once('spawn', () => {
        if (typeof child.unref === 'function') {
          try {
            child.unref();
          } catch {
            // The process has already spawned; failing to unref should not block launch.
          }
        }
        settle(resolve, { executablePath, args });
      });
      return;
    }

    if (child && typeof child.unref === 'function') {
      child.unref();
    }

    settle(resolve, { executablePath, args });
  });
}

if (require.main === module) {
  launch().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[quakeshell] ${message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  createLaunchError,
  isSpawnUnknownError,
  launch,
  resolveExecutablePath,
};