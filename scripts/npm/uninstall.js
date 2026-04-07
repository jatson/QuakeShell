#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const {
  INSTALL_ROOT_ENV,
  getInstallRoot,
} = require('./distribution');

function writeMessage(logger, message) {
  const writer = logger.log || logger.info;
  if (typeof writer === 'function') {
    writer.call(logger, message);
  }
}

function isPathMissing(error) {
  return Boolean(error && typeof error === 'object' && error.code === 'ENOENT');
}

function isBusyError(error) {
  return Boolean(error && typeof error === 'object' && ['EBUSY', 'EPERM'].includes(error.code));
}

function getManagedPaths(installRoot) {
  return [
    path.join(installRoot, 'versions'),
    path.join(installRoot, 'tmp'),
  ];
}

function parseUninstallArgs(args = []) {
  const parsedOptions = {
    dryRun: false,
    help: false,
    installRoot: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--dry-run') {
      parsedOptions.dryRun = true;
      continue;
    }

    if (argument === '--help' || argument === '-h') {
      parsedOptions.help = true;
      continue;
    }

    if (argument === '--install-root') {
      index += 1;
      if (index >= args.length || args[index].trim() === '') {
        throw new Error('Missing value for --install-root.');
      }

      parsedOptions.installRoot = args[index];
      continue;
    }

    if (argument.startsWith('--install-root=')) {
      const installRoot = argument.slice('--install-root='.length).trim();
      if (installRoot === '') {
        throw new Error('Missing value for --install-root.');
      }

      parsedOptions.installRoot = installRoot;
      continue;
    }

    throw new Error(`Unknown uninstall option: ${argument}`);
  }

  return parsedOptions;
}

function getHelpText() {
  return [
    'Usage: quakeshell uninstall [--dry-run] [--install-root <path>]',
    '',
    'Removes the npm-managed QuakeShell cache downloaded by the wrapper package.',
    `The install root defaults to ${INSTALL_ROOT_ENV} or %USERPROFILE%\\.quakeshell\\npm.`,
    'User settings in %APPDATA%\\QuakeShell are preserved.',
  ].join('\n');
}

function getRemovalPlan(installRoot, fileSystem = fs) {
  const candidatePaths = [];
  const managedPaths = getManagedPaths(installRoot);

  for (const managedPath of managedPaths) {
    if (fileSystem.existsSync(managedPath)) {
      candidatePaths.push(managedPath);
    }
  }

  if (fileSystem.existsSync(installRoot)) {
    const entries = fileSystem.readdirSync(installRoot);
    if (entries.length === 0 || entries.every((entry) => ['versions', 'tmp'].includes(entry))) {
      candidatePaths.push(installRoot);
    }
  }

  return candidatePaths;
}

function createUninstallError(targetPath, error) {
  const detail = error instanceof Error ? error.message : String(error);

  if (isBusyError(error)) {
    return new Error(
      `Unable to remove ${targetPath}. Close all QuakeShell windows and retry \`quakeshell uninstall\`. Original error: ${detail}`,
      { cause: error instanceof Error ? error : undefined },
    );
  }

  return new Error(
    `Unable to remove ${targetPath}. ${detail}`,
    { cause: error instanceof Error ? error : undefined },
  );
}

function removePath(targetPath, fileSystem = fs) {
  try {
    fileSystem.rmSync(targetPath, {
      recursive: true,
      force: true,
      maxRetries: 2,
      retryDelay: 100,
    });
  } catch (error) {
    if (isPathMissing(error)) {
      return false;
    }

    throw createUninstallError(targetPath, error);
  }

  return true;
}

function uninstallPackage(options = {}) {
  const fileSystem = options.fileSystem || fs;
  const environment = options.environment || process.env;
  const installRoot = path.resolve(options.installRoot || getInstallRoot(environment));
  const candidatePaths = getRemovalPlan(installRoot, fileSystem);

  if (candidatePaths.length === 0) {
    return {
      status: 'noop',
      installRoot,
      candidatePaths,
      removedPaths: [],
    };
  }

  if (options.dryRun) {
    return {
      status: 'dry-run',
      installRoot,
      candidatePaths,
      removedPaths: [],
    };
  }

  const removedPaths = [];
  for (const candidatePath of candidatePaths) {
    if (removePath(candidatePath, fileSystem)) {
      removedPaths.push(candidatePath);
    }
  }

  return {
    status: 'removed',
    installRoot,
    candidatePaths,
    removedPaths,
  };
}

async function runUninstallCommand(options = {}) {
  const logger = options.logger || console;
  const args = options.args || process.argv.slice(2);
  const parsedOptions = parseUninstallArgs(args);

  if (parsedOptions.help) {
    writeMessage(logger, getHelpText());
    return { status: 'help' };
  }

  const result = uninstallPackage({
    ...options,
    dryRun: parsedOptions.dryRun,
    installRoot: parsedOptions.installRoot,
  });

  if (result.status === 'noop') {
    writeMessage(logger, `[quakeshell] No npm-managed QuakeShell files were found under ${result.installRoot}.`);
    if (!parsedOptions.installRoot && !(options.environment || process.env)[INSTALL_ROOT_ENV]) {
      writeMessage(logger, `[quakeshell] If you used ${INSTALL_ROOT_ENV}, pass it again or use --install-root <path>.`);
    }
    return result;
  }

  writeMessage(
    logger,
    `[quakeshell] ${result.status === 'dry-run' ? 'Would remove' : 'Removed'} the following npm-managed QuakeShell paths:`,
  );
  for (const candidatePath of result.candidatePaths) {
    writeMessage(logger, `  - ${candidatePath}`);
  }

  writeMessage(
    logger,
    `[quakeshell] ${result.status === 'dry-run' ? 'User settings would be preserved' : 'User settings were preserved'} in %APPDATA%\\QuakeShell.`,
  );
  writeMessage(logger, '[quakeshell] To remove the wrapper command itself, run: npm uninstall -g quakeshell');

  return result;
}

if (require.main === module) {
  runUninstallCommand().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[quakeshell] ${message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  getHelpText,
  getRemovalPlan,
  parseUninstallArgs,
  removePath,
  runUninstallCommand,
  uninstallPackage,
};