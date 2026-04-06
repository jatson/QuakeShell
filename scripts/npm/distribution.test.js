const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { isSourceCheckout, normalizeWindowsArchitecture, resolveRuntimeTarget } = require('./distribution');

function createTempDirectory(prefix = 'quakeshell-distribution-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('scripts/npm/distribution', () => {
  it('normalizes 32-bit Node on 64-bit Windows to the supported x64 target', () => {
    expect(resolveRuntimeTarget({
      arch: 'ia32',
      environment: {
        PROCESSOR_ARCHITECTURE: 'x86',
        PROCESSOR_ARCHITEW6432: 'AMD64',
      },
      platform: 'win32',
    })).toEqual({
      arch: 'x64',
      platform: 'win32',
    });
  });

  it('does not misclassify Windows ARM64 as x64', () => {
    expect(resolveRuntimeTarget({
      arch: 'ia32',
      environment: {
        PROCESSOR_ARCHITECTURE: 'ARM64',
      },
      platform: 'win32',
    })).toEqual({
      arch: 'ia32',
      platform: 'win32',
    });
  });

  it('normalizes only known Windows x64 architecture markers', () => {
    expect(normalizeWindowsArchitecture('AMD64')).toBe('x64');
    expect(normalizeWindowsArchitecture('ARM64')).toBe('arm64');
  });

  it('treats copied source trees as source checkouts even without .git metadata', () => {
    const packageRoot = createTempDirectory();

    try {
      fs.mkdirSync(path.join(packageRoot, 'src'), { recursive: true });
      fs.writeFileSync(path.join(packageRoot, 'forge.config.ts'), 'export default {};\n', 'utf8');

      expect(isSourceCheckout(packageRoot)).toBe(true);
    } finally {
      fs.rmSync(packageRoot, { recursive: true, force: true });
    }
  });
});