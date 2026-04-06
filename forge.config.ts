import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const PACKAGED_BUILD_ROOT = '/.vite';
const PACKAGED_NODE_MODULES_ROOT = '/node_modules';
const PACKAGED_NODE_PTY_ROOT = '/node_modules/node-pty';

function matchesPackagedRoot(filePath: string, rootPath: string): boolean {
  return filePath === rootPath
    || filePath === rootPath.slice(1)
    || filePath.startsWith(rootPath)
    || filePath.startsWith(rootPath.slice(1));
}

function normalizePackagerPath(file: unknown): string {
  if (typeof file !== 'string' || file.length === 0) {
    return '';
  }

  const normalizedPath = file.replace(/\\/g, '/');
  for (const marker of [PACKAGED_BUILD_ROOT, PACKAGED_NODE_MODULES_ROOT]) {
    const markerIndex = normalizedPath.indexOf(marker);
    if (markerIndex !== -1) {
      return normalizedPath.slice(markerIndex);
    }
  }

  return normalizedPath;
}

function ignoreNonPackagedRuntimeFiles(file: unknown): boolean {
  const normalizedFile = normalizePackagerPath(file);
  if (!normalizedFile) {
    return false;
  }

  return !matchesPackagedRoot(normalizedFile, PACKAGED_NODE_MODULES_ROOT)
    && !matchesPackagedRoot(normalizedFile, PACKAGED_BUILD_ROOT)
    && !matchesPackagedRoot(normalizedFile, PACKAGED_NODE_PTY_ROOT);
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    extraResource: ['./themes'],
    ignore: ignoreNonPackagedRuntimeFiles,
  },
  rebuildConfig: {
    onlyModules: ['node-pty'],
  },
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
