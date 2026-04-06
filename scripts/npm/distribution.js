#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SUPPORTED_PLATFORM = 'win32';
const SUPPORTED_ARCH = 'x64';
const INSTALL_ROOT_ENV = 'QUAKESHELL_INSTALL_ROOT';
const MANUAL_BINARY_ENV = 'QUAKESHELL_BINARY_PATH';
const ASSET_URL_ENV = 'QUAKESHELL_ASSET_URL';
const RELEASE_BASE_URL_ENV = 'QUAKESHELL_RELEASE_BASE_URL';
const SKIP_DOWNLOAD_ENV = 'QUAKESHELL_SKIP_DOWNLOAD';
const INSTALL_MANIFEST_NAME = 'install.json';
const CHECKSUM_SUFFIX = '.sha256';
const WINDOWS_X64_ARCHITECTURES = new Set(['amd64', 'x64', 'x86_64']);

function resolvePackageRoot(startDir = __dirname) {
  return path.resolve(startDir, '..', '..');
}

function readPackageMetadata(packageRoot = resolvePackageRoot()) {
  const packageJsonPath = path.join(packageRoot, 'package.json');
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

function trimTrailingSlash(value) {
  return value.replace(/[\\/]+$/, '');
}

function getRepositorySource(metadata) {
  const repository = metadata.repository;
  if (!repository) {
    throw new Error('package.json repository is required to derive the QuakeShell release URL.');
  }

  if (typeof repository === 'string') {
    return repository;
  }

  if (typeof repository.url === 'string' && repository.url.trim() !== '') {
    return repository.url;
  }

  throw new Error('package.json repository.url is required to derive the QuakeShell release URL.');
}

function parseGitHubRepository(metadata) {
  const source = trimTrailingSlash(
    getRepositorySource(metadata)
      .replace(/^git\+/, '')
      .replace(/\.git$/i, ''),
  );
  const match = source.match(/github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/]+)$/i);

  if (!match || !match.groups) {
    throw new Error(`Unable to derive GitHub owner/repo from repository URL: ${source}`);
  }

  return {
    owner: match.groups.owner,
    repo: match.groups.repo,
    httpsUrl: `https://github.com/${match.groups.owner}/${match.groups.repo}`,
  };
}

function getReleaseTag(version) {
  return `v${version}`;
}

function getAssetName(metadata, platform = SUPPORTED_PLATFORM, arch = SUPPORTED_ARCH) {
  return `${metadata.name}-${metadata.version}-${platform}-${arch}.zip`;
}

function getReleaseAssetUrl(metadata, environment = process.env, platform = SUPPORTED_PLATFORM, arch = SUPPORTED_ARCH) {
  if (typeof environment[ASSET_URL_ENV] === 'string' && environment[ASSET_URL_ENV].trim() !== '') {
    return environment[ASSET_URL_ENV].trim();
  }

  const assetName = getAssetName(metadata, platform, arch);

  if (typeof environment[RELEASE_BASE_URL_ENV] === 'string' && environment[RELEASE_BASE_URL_ENV].trim() !== '') {
    return `${trimTrailingSlash(environment[RELEASE_BASE_URL_ENV].trim())}/${assetName}`;
  }

  const { owner, repo } = parseGitHubRepository(metadata);
  return `https://github.com/${owner}/${repo}/releases/download/${getReleaseTag(metadata.version)}/${assetName}`;
}

function getReleaseAssetChecksumUrl(metadata, environment = process.env, platform = SUPPORTED_PLATFORM, arch = SUPPORTED_ARCH) {
  return `${getReleaseAssetUrl(metadata, environment, platform, arch)}${CHECKSUM_SUFFIX}`;
}

function normalizeWindowsArchitecture(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (WINDOWS_X64_ARCHITECTURES.has(normalizedValue)) {
    return SUPPORTED_ARCH;
  }

  return normalizedValue || null;
}

function resolveRuntimeTarget(options = {}) {
  const environment = options.environment || process.env;
  const platform = options.platform || process.platform;
  const requestedArch = options.arch || process.arch;

  if (platform !== SUPPORTED_PLATFORM) {
    return { platform, arch: requestedArch };
  }

  if (requestedArch === SUPPORTED_ARCH) {
    return { platform, arch: requestedArch };
  }

  const osArchitecture = [environment.PROCESSOR_ARCHITEW6432, environment.PROCESSOR_ARCHITECTURE]
    .map((value) => normalizeWindowsArchitecture(value))
    .find(Boolean);

  if (osArchitecture === SUPPORTED_ARCH) {
    return { platform, arch: SUPPORTED_ARCH };
  }

  return { platform, arch: requestedArch };
}

function getInstallRoot(environment = process.env) {
  const configuredRoot = environment[INSTALL_ROOT_ENV];
  return path.resolve(configuredRoot || path.join(os.homedir(), '.quakeshell', 'npm'));
}

function getVersionDirectoryName(metadata, platform = SUPPORTED_PLATFORM, arch = SUPPORTED_ARCH) {
  return `${metadata.version}-${platform}-${arch}`;
}

function getVersionInstallDir(metadata, environment = process.env, platform = SUPPORTED_PLATFORM, arch = SUPPORTED_ARCH) {
  return path.join(getInstallRoot(environment), 'versions', getVersionDirectoryName(metadata, platform, arch));
}

function getManifestPath(metadata, environment = process.env, platform = SUPPORTED_PLATFORM, arch = SUPPORTED_ARCH) {
  return path.join(getVersionInstallDir(metadata, environment, platform, arch), INSTALL_MANIFEST_NAME);
}

function getExecutableName(metadata) {
  return `${metadata.name}.exe`;
}

function getManualBinaryPath(environment = process.env) {
  const configuredPath = environment[MANUAL_BINARY_ENV];
  if (typeof configuredPath !== 'string' || configuredPath.trim() === '') {
    return null;
  }

  return path.resolve(configuredPath.trim());
}

function shouldSkipDownload(environment = process.env) {
  const configuredValue = environment[SKIP_DOWNLOAD_ENV];
  if (typeof configuredValue !== 'string') {
    return false;
  }

  return !['', '0', 'false', 'no', 'off'].includes(configuredValue.trim().toLowerCase());
}

function isSourceCheckout(packageRoot = resolvePackageRoot()) {
  return fs.existsSync(path.join(packageRoot, 'src'))
    && fs.existsSync(path.join(packageRoot, 'forge.config.ts'));
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
  return directoryPath;
}

function readInstallManifest(metadata, environment = process.env, platform = SUPPORTED_PLATFORM, arch = SUPPORTED_ARCH) {
  const manifestPath = getManifestPath(metadata, environment, platform, arch);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

function isInstallManifestValid(manifest) {
  return Boolean(
    manifest
      && typeof manifest.executablePath === 'string'
      && manifest.executablePath.trim() !== ''
      && fs.existsSync(manifest.executablePath),
  );
}

function findExecutable(rootDirectory, executableName) {
  if (!fs.existsSync(rootDirectory)) {
    return null;
  }

  const pendingDirectories = [rootDirectory];
  const targetName = executableName.toLowerCase();
  const visitedDirectories = new Set();

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    let realPath;
    try {
      realPath = (fs.realpathSync.native || fs.realpathSync)(currentDirectory);
    } catch {
      continue;
    }

    if (visitedDirectories.has(realPath)) {
      continue;
    }

    visitedDirectories.add(realPath);
    let entries;
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

function findPackagedExecutable(packageRoot, metadata) {
  return findExecutable(path.join(packageRoot, 'out'), getExecutableName(metadata));
}

function createInstallManifest(metadata, executablePath, assetUrl, source, platform = SUPPORTED_PLATFORM, arch = SUPPORTED_ARCH) {
  return {
    packageName: metadata.name,
    version: metadata.version,
    platform,
    arch,
    executablePath: path.resolve(executablePath),
    assetUrl: assetUrl || null,
    source,
    installedAt: new Date().toISOString(),
  };
}

function writeInstallManifestAtPath(manifestPath, manifest) {
  ensureDirectory(path.dirname(manifestPath));
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifestPath;
}

function writeInstallManifest(metadata, manifest, environment = process.env, platform = SUPPORTED_PLATFORM, arch = SUPPORTED_ARCH) {
  return writeInstallManifestAtPath(
    getManifestPath(metadata, environment, platform, arch),
    manifest,
  );
}

module.exports = {
  ASSET_URL_ENV,
  CHECKSUM_SUFFIX,
  INSTALL_MANIFEST_NAME,
  INSTALL_ROOT_ENV,
  MANUAL_BINARY_ENV,
  RELEASE_BASE_URL_ENV,
  SKIP_DOWNLOAD_ENV,
  SUPPORTED_ARCH,
  SUPPORTED_PLATFORM,
  createInstallManifest,
  ensureDirectory,
  findExecutable,
  findPackagedExecutable,
  getAssetName,
  getExecutableName,
  getInstallRoot,
  getManifestPath,
  getManualBinaryPath,
  getReleaseAssetUrl,
  getReleaseAssetChecksumUrl,
  getReleaseTag,
  getVersionDirectoryName,
  getVersionInstallDir,
  isInstallManifestValid,
  isSourceCheckout,
  normalizeWindowsArchitecture,
  parseGitHubRepository,
  readInstallManifest,
  readPackageMetadata,
  resolveRuntimeTarget,
  resolvePackageRoot,
  shouldSkipDownload,
  writeInstallManifest,
  writeInstallManifestAtPath,
};