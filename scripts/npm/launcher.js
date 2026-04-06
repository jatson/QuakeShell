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
  const executablePath = options.executablePath || resolveExecutablePath(options);
  const args = options.args || process.argv.slice(2);
  const child = spawnImpl(executablePath, args, {
    cwd: options.cwd || process.cwd(),
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });

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
        settle(reject, error);
      });
      child.once('spawn', () => {
        if (typeof child.unref === 'function') {
          child.unref();
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
  launch,
  resolveExecutablePath,
};