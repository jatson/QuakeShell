const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  assertPackagedExecutableVersion,
  resolvePackagedAppDir,
  runPackageBuild,
  writeChecksumFile,
} = require('./package-release');

function createTempDirectory(prefix = 'quakeshell-release-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('scripts/npm/package-release', () => {
  it('uses cmd.exe wrapping for npm on Windows', () => {
    const runner = vi.fn(() => ({ status: 0 }));

    runPackageBuild('C:/Projects/QuakeShell', 'win32', runner);

    expect(runner).toHaveBeenCalledWith(
      expect.stringMatching(/(?:cmd\.exe)$/i),
      ['/d', '/s', '/c', 'npm run package'],
      {
        cwd: 'C:/Projects/QuakeShell',
        stdio: 'inherit',
      },
    );
  });

  it('invokes npm directly on non-Windows platforms', () => {
    const runner = vi.fn(() => ({ status: 0 }));

    runPackageBuild('/workspace/quakeshell', 'linux', runner);

    expect(runner).toHaveBeenCalledWith(
      'npm',
      ['run', 'package'],
      {
        cwd: '/workspace/quakeshell',
        stdio: 'inherit',
      },
    );
  });

  it('writes a sha256 checksum file for the generated asset', async () => {
    const tempDirectory = createTempDirectory();
    const assetPath = path.join(tempDirectory, 'quakeshell-9.9.9-win32-x64.zip');

    try {
      fs.writeFileSync(assetPath, 'zip-bytes', 'utf8');

      const checksumPath = await writeChecksumFile(assetPath);
      const checksumContents = fs.readFileSync(checksumPath, 'utf8');

      expect(checksumPath).toBe(`${assetPath}.sha256`);
      expect(checksumContents).toMatch(/^[a-f0-9]{64}\s\squakeshell-9\.9\.9-win32-x64\.zip\r?\n$/i);
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it('fails when multiple packaged app directories match under out', () => {
    const tempDirectory = createTempDirectory();
    const metadata = { name: 'quakeshell', productName: 'quakeshell' };
    const firstDirectory = path.join(tempDirectory, 'out', 'a');
    const secondDirectory = path.join(tempDirectory, 'out', 'b');

    try {
      fs.mkdirSync(firstDirectory, { recursive: true });
      fs.mkdirSync(secondDirectory, { recursive: true });
      fs.writeFileSync(path.join(firstDirectory, 'quakeshell.exe'), 'exe', 'utf8');
      fs.writeFileSync(path.join(secondDirectory, 'quakeshell.exe'), 'exe', 'utf8');

      expect(() => resolvePackagedAppDir(tempDirectory, metadata)).toThrow('Multiple packaged apps');
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it('ignores stale packaged output when a fresh build is required', () => {
    const tempDirectory = createTempDirectory();
    const metadata = { name: 'quakeshell', productName: 'quakeshell' };
    const packagedDirectory = path.join(tempDirectory, 'out', 'quakeshell-win32-x64');
    const executablePath = path.join(packagedDirectory, 'quakeshell.exe');

    try {
      fs.mkdirSync(packagedDirectory, { recursive: true });
      fs.writeFileSync(executablePath, 'exe', 'utf8');
      const staleDate = new Date('2024-01-01T00:00:00.000Z');
      fs.utimesSync(executablePath, staleDate, staleDate);

      expect(() => resolvePackagedAppDir(tempDirectory, metadata, {
        minExecutableMtimeMs: Date.parse('2024-01-02T00:00:00.000Z'),
      })).toThrow('No packaged app containing quakeshell.exe');
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it('fails when the packaged executable version does not match package.json', () => {
    const tempDirectory = createTempDirectory();
    const metadata = { name: 'quakeshell', productName: 'quakeshell', version: '9.9.9' };
    const packagedDirectory = path.join(tempDirectory, 'out', 'quakeshell-win32-x64');
    const powerShellRunner = vi.fn(() => ({ status: 0, stdout: '9.9.8\n', stderr: '' }));

    try {
      fs.mkdirSync(packagedDirectory, { recursive: true });
      fs.writeFileSync(path.join(packagedDirectory, 'quakeshell.exe'), 'exe', 'utf8');

      expect(() => assertPackagedExecutableVersion(packagedDirectory, metadata, powerShellRunner)).toThrow(
        'does not match package version 9.9.9',
      );
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });
});