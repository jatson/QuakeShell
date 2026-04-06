const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  BACKUP_FILE,
  OMITTED_PUBLISHED_SCRIPTS,
  PUBLISHED_MAIN,
  preparePublishedManifest,
  restoreDevelopmentManifest,
} = require('./publish-manifest');

function createTempDirectory(prefix = 'quakeshell-publish-manifest-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writePackageJson(packageRoot, data) {
  fs.writeFileSync(path.join(packageRoot, 'package.json'), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function readPackageJson(packageRoot) {
  return JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
}

describe('scripts/npm/publish-manifest', () => {
  it('refreshes the backup from the current development manifest before publishing', () => {
    const packageRoot = createTempDirectory();
    const backupPath = path.join(packageRoot, BACKUP_FILE);

    try {
      writePackageJson(packageRoot, {
        name: 'quakeshell',
        version: '1.0.1',
        main: '.vite/build/index.js',
        scripts: {
          prepack: 'node scripts/npm/publish-manifest.js prepare',
          postpack: 'node scripts/npm/publish-manifest.js restore',
          'release:asset': 'node scripts/npm/package-release.js',
          start: 'electron-forge start',
        },
      });

      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.writeFileSync(backupPath, JSON.stringify({
        name: 'quakeshell',
        version: '1.0.0',
        main: '.vite/build/index.js',
      }, null, 2), 'utf8');

      preparePublishedManifest(packageRoot);
      const preparedPackageJson = readPackageJson(packageRoot);
      for (const omittedScript of OMITTED_PUBLISHED_SCRIPTS) {
        expect(preparedPackageJson.scripts[omittedScript]).toBeUndefined();
      }
      expect(preparedPackageJson.scripts.start).toBe('electron-forge start');
      restoreDevelopmentManifest(packageRoot);

      expect(readPackageJson(packageRoot).version).toBe('1.0.1');
    } finally {
      fs.rmSync(packageRoot, { recursive: true, force: true });
    }
  });

  it('fails fast when package.json is already in published mode and a stale backup exists', () => {
    const packageRoot = createTempDirectory();
    const backupPath = path.join(packageRoot, BACKUP_FILE);

    try {
      writePackageJson(packageRoot, {
        name: 'quakeshell',
        version: '1.0.1',
        main: PUBLISHED_MAIN,
      });

      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.writeFileSync(backupPath, JSON.stringify({
        name: 'quakeshell',
        version: '1.0.0',
        main: '.vite/build/index.js',
      }, null, 2), 'utf8');

      expect(() => preparePublishedManifest(packageRoot)).toThrow('already in published mode');
    } finally {
      fs.rmSync(packageRoot, { recursive: true, force: true });
    }
  });
});