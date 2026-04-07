const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  parseUninstallArgs,
  runUninstallCommand,
  uninstallPackage,
} = require('./uninstall');

function createTempDirectory(prefix = 'quakeshell-uninstall-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function removeDirectory(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true });
}

describe('scripts/npm/uninstall', () => {
  const temporaryPaths = [];

  afterEach(() => {
    while (temporaryPaths.length > 0) {
      removeDirectory(temporaryPaths.pop());
    }
  });

  function createEnvironment() {
    const installRoot = createTempDirectory();
    temporaryPaths.push(installRoot);

    return {
      installRoot,
      environment: {
        QUAKESHELL_INSTALL_ROOT: installRoot,
      },
    };
  }

  function createManagedInstall(installRoot) {
    const versionDirectory = path.join(installRoot, 'versions', '9.9.9-win32-x64');
    const tempDirectory = path.join(installRoot, 'tmp', 'download');

    fs.mkdirSync(versionDirectory, { recursive: true });
    fs.mkdirSync(tempDirectory, { recursive: true });
    fs.writeFileSync(path.join(versionDirectory, 'quakeshell.exe'), 'exe', 'utf8');
    fs.writeFileSync(path.join(versionDirectory, 'install.json'), '{}\n', 'utf8');
    fs.writeFileSync(path.join(tempDirectory, 'partial.zip'), 'zip', 'utf8');
  }

  it('removes managed versions and temporary files, then prunes an empty install root', () => {
    const context = createEnvironment();
    createManagedInstall(context.installRoot);

    const result = uninstallPackage({ environment: context.environment });

    expect(result.status).toBe('removed');
    expect(result.removedPaths).toContain(path.join(context.installRoot, 'versions'));
    expect(result.removedPaths).toContain(path.join(context.installRoot, 'tmp'));
    expect(result.removedPaths).toContain(context.installRoot);
    expect(fs.existsSync(context.installRoot)).toBe(false);
  });

  it('preserves unrelated files outside the managed cache', () => {
    const context = createEnvironment();
    const notesPath = path.join(context.installRoot, 'notes.txt');

    createManagedInstall(context.installRoot);
    fs.writeFileSync(notesPath, 'keep me', 'utf8');

    const result = uninstallPackage({ environment: context.environment });

    expect(result.status).toBe('removed');
    expect(result.removedPaths).not.toContain(context.installRoot);
    expect(fs.existsSync(notesPath)).toBe(true);
    expect(fs.existsSync(path.join(context.installRoot, 'versions'))).toBe(false);
    expect(fs.existsSync(path.join(context.installRoot, 'tmp'))).toBe(false);
  });

  it('supports dry runs without deleting the managed cache', () => {
    const context = createEnvironment();
    createManagedInstall(context.installRoot);

    const result = uninstallPackage({
      dryRun: true,
      environment: context.environment,
    });

    expect(result.status).toBe('dry-run');
    expect(result.candidatePaths).toContain(path.join(context.installRoot, 'versions'));
    expect(result.candidatePaths).toContain(path.join(context.installRoot, 'tmp'));
    expect(fs.existsSync(path.join(context.installRoot, 'versions'))).toBe(true);
    expect(fs.existsSync(path.join(context.installRoot, 'tmp'))).toBe(true);
  });

  it('parses uninstall options for dry-run and install-root overrides', () => {
    expect(parseUninstallArgs(['--dry-run', '--install-root', 'C:\\Cache'])).toEqual({
      dryRun: true,
      help: false,
      installRoot: 'C:\\Cache',
    });

    expect(parseUninstallArgs(['--install-root=C:\\Cache'])).toEqual({
      dryRun: false,
      help: false,
      installRoot: 'C:\\Cache',
    });
  });

  it('logs the wrapper-removal next step after cleanup', async () => {
    const context = createEnvironment();
    const logger = { log: vi.fn() };

    createManagedInstall(context.installRoot);

    await expect(runUninstallCommand({
      environment: context.environment,
      logger,
    })).resolves.toMatchObject({ status: 'removed' });

    const output = logger.log.mock.calls.map(([message]) => message).join('\n');
    expect(output).toContain('npm uninstall -g quakeshell');
    expect(output).toContain('%APPDATA%\\QuakeShell');
  });
});