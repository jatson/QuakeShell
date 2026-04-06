#!/usr/bin/env node

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const {
  CHECKSUM_SUFFIX,
  MANUAL_BINARY_ENV,
  SUPPORTED_ARCH,
  SUPPORTED_PLATFORM,
  createInstallManifest,
  ensureDirectory,
  findExecutable,
  getAssetName,
  getExecutableName,
  getInstallRoot,
  getManifestPath,
  getManualBinaryPath,
  getReleaseAssetUrl,
  getReleaseAssetChecksumUrl,
  getVersionInstallDir,
  isInstallManifestValid,
  isSourceCheckout,
  readInstallManifest,
  readPackageMetadata,
  resolveRuntimeTarget,
  resolvePackageRoot,
  shouldSkipDownload,
  writeInstallManifest,
  writeInstallManifestAtPath,
} = require('./distribution');

function toPowerShellLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function logInfo(logger, message) {
  const writer = logger.info || logger.log;
  if (typeof writer === 'function') {
    writer.call(logger, message);
  }
}

function runPowerShell(command, runner = spawnSync) {
  const result = runner(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    { stdio: 'pipe', encoding: 'utf8' },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : '';
    throw new Error(stderr || stdout || `PowerShell command failed with exit code ${result.status}.`);
  }

  return typeof result.stdout === 'string' ? result.stdout : '';
}

function normalizeVersion(value) {
  const trimmedValue = String(value || '').trim();
  if (trimmedValue === '') {
    return '';
  }

  const versionWithoutBuild = trimmedValue.split('+')[0];
  const prereleaseIndex = versionWithoutBuild.indexOf('-');
  const coreVersion = prereleaseIndex === -1
    ? versionWithoutBuild
    : versionWithoutBuild.slice(0, prereleaseIndex);
  const prereleaseSuffix = prereleaseIndex === -1
    ? ''
    : versionWithoutBuild.slice(prereleaseIndex);
  const versionParts = coreVersion.split('.').filter(Boolean);

  while (versionParts.length > 3 && versionParts[versionParts.length - 1] === '0') {
    versionParts.pop();
  }

  return `${versionParts.join('.')}${prereleaseSuffix}`;
}

function readChecksumFile(checksumPath) {
  const checksum = fs.readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
  if (!/^[a-f0-9]{64}$/i.test(checksum || '')) {
    throw new Error(`Checksum file at ${checksumPath} did not contain a valid SHA-256 value.`);
  }

  return checksum.toLowerCase();
}

function computeFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });
    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });
    stream.on('error', reject);
  });
}

async function verifyDownloadedAsset(assetPath, checksumPath) {
  const expectedChecksum = readChecksumFile(checksumPath);
  const actualChecksum = await computeFileSha256(assetPath);

  if (actualChecksum !== expectedChecksum) {
    throw new Error(`Downloaded QuakeShell asset checksum mismatch for ${path.basename(assetPath)}.`);
  }
}

function getExecutableVersion(executablePath, runner = spawnSync) {
  const command = `(Get-Item -LiteralPath ${toPowerShellLiteral(executablePath)}).VersionInfo.ProductVersion`;
  return runPowerShell(command, runner).trim();
}

function ensureExecutableVersion(executablePath, expectedVersion, runner = spawnSync) {
  const actualVersion = getExecutableVersion(executablePath, runner);
  if (normalizeVersion(actualVersion) !== normalizeVersion(expectedVersion)) {
    throw new Error(
      `Provisioned QuakeShell executable version ${actualVersion || 'unknown'} does not match package version ${expectedVersion}.`,
    );
  }

  return actualVersion;
}

function canReuseExecutable(executablePath, expectedVersion, runner = spawnSync, logger = console, sourceLabel = 'cached installation') {
  try {
    ensureExecutableVersion(executablePath, expectedVersion, runner);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logInfo(logger, `[quakeshell] Ignoring ${sourceLabel}: ${message}`);
    return false;
  }
}

async function downloadFile(url, destinationPath, fetchImpl = globalThis.fetch, options = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Global fetch is unavailable. Use Node.js 20 or newer to install QuakeShell from npm.');
  }

  const timeoutMs = options.timeoutMs ?? 300_000;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const response = await fetchImpl(url, controller ? { signal: controller.signal } : undefined);
    if (!response.ok || !response.body) {
      await response.body?.cancel?.();
      throw new Error(`Unable to download ${url} (HTTP ${response.status}).`);
    }

    await pipeline(
      Readable.fromWeb(response.body),
      fs.createWriteStream(destinationPath),
    );
  } catch (error) {
    if (controller && controller.signal.aborted) {
      throw new Error(`Timed out downloading ${url} after ${timeoutMs}ms.`);
    }

    throw error;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function expandArchive(zipPath, destinationPath, runner = spawnSync) {
  ensureDirectory(destinationPath);
  const command = `Expand-Archive -LiteralPath ${toPowerShellLiteral(zipPath)} -DestinationPath ${toPowerShellLiteral(destinationPath)} -Force`;
  runPowerShell(command, runner);
}

function resolveManualExecutable(environment) {
  const manualBinaryPath = getManualBinaryPath(environment);
  if (!manualBinaryPath) {
    return null;
  }

  if (!fs.existsSync(manualBinaryPath)) {
    throw new Error(`${MANUAL_BINARY_ENV} does not exist: ${manualBinaryPath}`);
  }

  const manualBinaryStat = fs.statSync(manualBinaryPath);
  if (!manualBinaryStat.isFile() || path.extname(manualBinaryPath).toLowerCase() !== '.exe') {
    throw new Error(`${MANUAL_BINARY_ENV} must point to an existing .exe file: ${manualBinaryPath}`);
  }

  return manualBinaryPath;
}

async function installPackage(options = {}) {
  const packageRoot = options.packageRoot || resolvePackageRoot();
  const environment = options.environment || process.env;
  const runtimeTarget = options.runtimeTarget || resolveRuntimeTarget({
    environment,
    platform: options.platform || process.platform,
    arch: options.arch || process.arch,
  });
  const platform = runtimeTarget.platform;
  const arch = runtimeTarget.arch;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const powerShellRunner = options.powerShellRunner || spawnSync;
  const downloadTimeoutMs = options.downloadTimeoutMs ?? 300_000;
  const logger = options.logger || console;
  const metadata = options.metadata || readPackageMetadata(packageRoot);
  const versionDir = getVersionInstallDir(metadata, environment, platform, arch);
  const manifestPath = getManifestPath(metadata, environment, platform, arch);

  if (isSourceCheckout(packageRoot)) {
    logInfo(logger, '[quakeshell] Skipping npm postinstall provisioning in the source checkout.');
    return { status: 'skipped', reason: 'source-checkout' };
  }

  if (platform !== SUPPORTED_PLATFORM || arch !== SUPPORTED_ARCH) {
    throw new Error('QuakeShell npm install is currently supported on Windows x64 only.');
  }

  const manualExecutable = resolveManualExecutable(environment);
  if (manualExecutable) {
    ensureExecutableVersion(manualExecutable, metadata.version, powerShellRunner);
    const manifest = createInstallManifest(metadata, manualExecutable, null, 'manual', platform, arch);
    writeInstallManifest(metadata, manifest, environment, platform, arch);
    logInfo(logger, `[quakeshell] Registered QuakeShell ${metadata.version} from ${MANUAL_BINARY_ENV}.`);
    return { status: 'installed', manifest };
  }

  const cachedManifest = readInstallManifest(metadata, environment, platform, arch);
  if (isInstallManifestValid(cachedManifest)) {
    if (canReuseExecutable(cachedManifest.executablePath, metadata.version, powerShellRunner, logger, 'cached installation manifest')) {
      logInfo(logger, `[quakeshell] Reusing cached QuakeShell ${metadata.version} installation.`);
      return { status: 'reused', manifest: cachedManifest };
    }

    fs.rmSync(manifestPath, { force: true });
  }

  const cachedExecutable = findExecutable(versionDir, getExecutableName(metadata));
  if (cachedExecutable && canReuseExecutable(cachedExecutable, metadata.version, powerShellRunner, logger, 'cached installation directory')) {
    const repairedManifest = createInstallManifest(metadata, cachedExecutable, null, 'cache', platform, arch);
    writeInstallManifest(metadata, repairedManifest, environment, platform, arch);
    logInfo(logger, `[quakeshell] Repaired cached QuakeShell ${metadata.version} installation metadata.`);
    return { status: 'reused', manifest: repairedManifest };
  }

  if (shouldSkipDownload(environment)) {
    throw new Error(
      'QUAKESHELL_SKIP_DOWNLOAD is set, but no compatible cached QuakeShell installation was found. Clear QUAKESHELL_SKIP_DOWNLOAD or set QUAKESHELL_BINARY_PATH to an existing .exe.',
    );
  }

  const installRoot = getInstallRoot(environment);
  const tempRoot = path.join(
    installRoot,
    'tmp',
    `${metadata.version}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  );
  const extractDirectory = path.join(tempRoot, 'extract');
  const assetUrl = getReleaseAssetUrl(metadata, environment, platform, arch);
  const assetPath = path.join(tempRoot, getAssetName(metadata, platform, arch));
  const checksumUrl = getReleaseAssetChecksumUrl(metadata, environment, platform, arch);
  const checksumPath = `${assetPath}${CHECKSUM_SUFFIX}`;
  const backupDirectory = `${versionDir}.backup`;
  let replacedExistingInstall = false;
  let movedExtractedFiles = false;

  try {
    ensureDirectory(tempRoot);
    logInfo(logger, `[quakeshell] Downloading ${assetUrl}`);
    await downloadFile(assetUrl, assetPath, fetchImpl, { timeoutMs: downloadTimeoutMs });
    logInfo(logger, `[quakeshell] Verifying ${path.basename(assetPath)} against ${checksumUrl}`);
    await downloadFile(checksumUrl, checksumPath, fetchImpl, { timeoutMs: downloadTimeoutMs });
    await verifyDownloadedAsset(assetPath, checksumPath);
    expandArchive(assetPath, extractDirectory, powerShellRunner);

    const extractedExecutable = findExecutable(extractDirectory, getExecutableName(metadata));
    if (!extractedExecutable) {
      throw new Error(`Downloaded release asset did not contain ${getExecutableName(metadata)}.`);
    }

    ensureExecutableVersion(extractedExecutable, metadata.version, powerShellRunner);

    const relativeExecutablePath = path.relative(extractDirectory, extractedExecutable);

    ensureDirectory(path.dirname(versionDir));
    fs.rmSync(backupDirectory, { recursive: true, force: true });
    if (fs.existsSync(versionDir)) {
      fs.renameSync(versionDir, backupDirectory);
      replacedExistingInstall = true;
    }

    fs.renameSync(extractDirectory, versionDir);
    movedExtractedFiles = true;

    const manifest = createInstallManifest(
      metadata,
      path.join(versionDir, relativeExecutablePath),
      assetUrl,
      'download',
      platform,
      arch,
    );
    writeInstallManifestAtPath(manifestPath, manifest);

    fs.rmSync(backupDirectory, { recursive: true, force: true });
    logInfo(logger, `[quakeshell] Installed QuakeShell ${metadata.version} to ${versionDir}`);
    return { status: 'installed', manifest };
  } catch (error) {
    if (replacedExistingInstall && fs.existsSync(backupDirectory)) {
      if (fs.existsSync(versionDir)) {
        fs.rmSync(versionDir, { recursive: true, force: true });
      }
      fs.renameSync(backupDirectory, versionDir);
    } else if (movedExtractedFiles && fs.existsSync(versionDir)) {
      fs.rmSync(versionDir, { recursive: true, force: true });
    }

    throw error;
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (require.main === module) {
  installPackage().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[quakeshell] ${message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  canReuseExecutable,
  computeFileSha256,
  downloadFile,
  ensureExecutableVersion,
  expandArchive,
  getExecutableVersion,
  installPackage,
  normalizeVersion,
  readChecksumFile,
  resolveManualExecutable,
  runPowerShell,
  verifyDownloadedAsset,
};