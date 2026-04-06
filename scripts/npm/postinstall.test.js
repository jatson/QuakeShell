const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createInstallManifest,
  getManifestPath,
  getVersionInstallDir,
  readPackageMetadata,
  writeInstallManifest,
} = require('./distribution');
const { installPackage, normalizeVersion } = require('./postinstall');

function createTempDirectory(prefix = 'quakeshell-npm-') {
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

describe('scripts/npm/postinstall', () => {
  const temporaryPaths = [];

  afterEach(() => {
    while (temporaryPaths.length > 0) {
      removeDirectory(temporaryPaths.pop());
    }
  });

  function createContext() {
    const packageRoot = createTempPackage();
    const installRoot = createTempDirectory('quakeshell-install-');
    temporaryPaths.push(packageRoot, installRoot);
    return {
      packageRoot,
      environment: {
        QUAKESHELL_INSTALL_ROOT: installRoot,
      },
    };
  }

  it('rejects unsupported platforms with a clear message', async () => {
    const context = createContext();

    await expect(
      installPackage({
        ...context,
        arch: 'x64',
        fetchImpl: vi.fn(),
        platform: 'darwin',
      }),
    ).rejects.toThrow('Windows x64 only');
  });

  it('fails cleanly when the release asset is missing', async () => {
    const context = createContext();
    const metadata = readPackageMetadata(context.packageRoot);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    await expect(
      installPackage({
        ...context,
        arch: 'x64',
        fetchImpl,
        platform: 'win32',
        powerShellRunner: vi.fn(),
      }),
    ).rejects.toThrow('HTTP 404');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(getManifestPath(metadata, context.environment, 'win32', 'x64'))).toBe(false);
  });

  it('reuses an existing cached installation without downloading again', async () => {
    const context = createContext();
    const metadata = readPackageMetadata(context.packageRoot);
    const versionDirectory = getVersionInstallDir(metadata, context.environment, 'win32', 'x64');
    const executablePath = path.join(versionDirectory, 'quakeshell.exe');
    const manifest = createInstallManifest(metadata, executablePath, null, 'cache', 'win32', 'x64');
    const fetchImpl = vi.fn();
    const powerShellRunner = vi.fn(() => ({ status: 0, stdout: '9.9.9\n', stderr: '' }));

    fs.mkdirSync(versionDirectory, { recursive: true });
    fs.writeFileSync(executablePath, 'exe', 'utf8');
    writeInstallManifest(metadata, manifest, context.environment, 'win32', 'x64');

    const result = await installPackage({
      ...context,
      arch: 'x64',
      fetchImpl,
      platform: 'win32',
      powerShellRunner,
    });

    expect(result.status).toBe('reused');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not reuse a cached installation when the executable version is stale', async () => {
    const context = createContext();
    const metadata = readPackageMetadata(context.packageRoot);
    const versionDirectory = getVersionInstallDir(metadata, context.environment, 'win32', 'x64');
    const executablePath = path.join(versionDirectory, 'quakeshell.exe');
    const manifest = createInstallManifest(metadata, executablePath, null, 'cache', 'win32', 'x64');
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    const powerShellRunner = vi.fn(() => ({ status: 0, stdout: '9.9.8\n', stderr: '' }));

    fs.mkdirSync(versionDirectory, { recursive: true });
    fs.writeFileSync(executablePath, 'exe', 'utf8');
    writeInstallManifest(metadata, manifest, context.environment, 'win32', 'x64');

    await expect(
      installPackage({
        ...context,
        arch: 'x64',
        fetchImpl,
        platform: 'win32',
        powerShellRunner,
      }),
    ).rejects.toThrow('HTTP 404');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(getManifestPath(metadata, context.environment, 'win32', 'x64'))).toBe(false);
  });

  it('prioritizes QUAKESHELL_BINARY_PATH over a cached installation', async () => {
    const context = createContext();
    const metadata = readPackageMetadata(context.packageRoot);
    const versionDirectory = getVersionInstallDir(metadata, context.environment, 'win32', 'x64');
    const cachedExecutablePath = path.join(versionDirectory, 'quakeshell.exe');
    const manualExecutablePath = path.join(createTempDirectory('quakeshell-manual-'), 'quakeshell.exe');
    const manifest = createInstallManifest(metadata, cachedExecutablePath, null, 'cache', 'win32', 'x64');
    const fetchImpl = vi.fn();
    const powerShellRunner = vi.fn(() => ({ status: 0, stdout: '9.9.9\n', stderr: '' }));

    temporaryPaths.push(path.dirname(manualExecutablePath));
    fs.mkdirSync(versionDirectory, { recursive: true });
    fs.writeFileSync(cachedExecutablePath, 'exe', 'utf8');
    fs.writeFileSync(manualExecutablePath, 'exe', 'utf8');
    writeInstallManifest(metadata, manifest, context.environment, 'win32', 'x64');

    const result = await installPackage({
      ...context,
      arch: 'x64',
      environment: {
        ...context.environment,
        QUAKESHELL_BINARY_PATH: manualExecutablePath,
      },
      fetchImpl,
      platform: 'win32',
      powerShellRunner,
    });

    expect(result.status).toBe('installed');
    expect(result.manifest.executablePath).toBe(manualExecutablePath);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails clearly when QUAKESHELL_SKIP_DOWNLOAD is set without a compatible local install', async () => {
    const context = createContext();

    await expect(
      installPackage({
        ...context,
        arch: 'x64',
        environment: {
          ...context.environment,
          QUAKESHELL_SKIP_DOWNLOAD: '1',
        },
        platform: 'win32',
      }),
    ).rejects.toThrow('no compatible cached QuakeShell installation was found');
  });

  it('preserves prerelease identifiers when normalizing versions', () => {
    expect(normalizeVersion('1.0.0-beta.2+build.5')).toBe('1.0.0-beta.2');
    expect(normalizeVersion('1.0.0.0')).toBe('1.0.0');
  });
});