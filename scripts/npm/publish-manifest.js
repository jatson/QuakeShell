#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const { resolvePackageRoot } = require('./distribution');

const PUBLISHED_MAIN = 'scripts/npm/launcher.js';
const BACKUP_FILE = path.join('scripts', 'npm', '.package.json.prepack-backup.json');
const OMITTED_PUBLISHED_SCRIPTS = ['prepack', 'postpack', 'publish', 'postpublish', 'forge:publish', 'release:asset', 'release:dry-run'];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function getPaths(packageRoot = resolvePackageRoot()) {
  return {
    backupPath: path.join(packageRoot, BACKUP_FILE),
    packageJsonPath: path.join(packageRoot, 'package.json'),
  };
}

function preparePublishedManifest(packageRoot = resolvePackageRoot()) {
  const { backupPath, packageJsonPath } = getPaths(packageRoot);
  const manifest = readJson(packageJsonPath);
  const backupExists = fs.existsSync(backupPath);

  if (backupExists && manifest.main === PUBLISHED_MAIN) {
    throw new Error(
      'package.json is already in published mode while a prepack backup exists. Run `node scripts/npm/publish-manifest.js restore` before preparing again.',
    );
  }

  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.copyFileSync(packageJsonPath, backupPath);

  manifest.main = PUBLISHED_MAIN;
  if (manifest.scripts && typeof manifest.scripts === 'object') {
    manifest.scripts = { ...manifest.scripts };
    for (const scriptName of OMITTED_PUBLISHED_SCRIPTS) {
      delete manifest.scripts[scriptName];
    }
  }
  writeJson(packageJsonPath, manifest);
}

function restoreDevelopmentManifest(packageRoot = resolvePackageRoot()) {
  const { backupPath, packageJsonPath } = getPaths(packageRoot);

  if (!fs.existsSync(backupPath)) {
    return;
  }

  fs.copyFileSync(backupPath, packageJsonPath);
  fs.rmSync(backupPath, { force: true });
}

if (require.main === module) {
  const command = process.argv[2];

  if (command === 'prepare') {
    preparePublishedManifest();
  } else if (command === 'restore') {
    restoreDevelopmentManifest();
  } else {
    console.error('[quakeshell] Usage: node scripts/npm/publish-manifest.js <prepare|restore>');
    process.exitCode = 1;
  }
}

module.exports = {
  BACKUP_FILE,
  OMITTED_PUBLISHED_SCRIPTS,
  PUBLISHED_MAIN,
  preparePublishedManifest,
  restoreDevelopmentManifest,
};