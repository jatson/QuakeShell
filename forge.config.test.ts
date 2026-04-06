import { describe, expect, it } from 'vitest';
import { ignoreNonPackagedRuntimeFiles } from './forge.config';

describe('forge ignoreNonPackagedRuntimeFiles', () => {
  it('preserves the source renderer build tree needed by packaged releases', () => {
    expect(ignoreNonPackagedRuntimeFiles('src')).toBe(false);
    expect(ignoreNonPackagedRuntimeFiles('src/renderer')).toBe(false);
    expect(ignoreNonPackagedRuntimeFiles('src/renderer/.vite/renderer/main_window/index.html')).toBe(false);
  });

  it('ignores non-runtime source files that should not be packaged', () => {
    expect(ignoreNonPackagedRuntimeFiles('src/main')).toBe(true);
    expect(ignoreNonPackagedRuntimeFiles('src/main/index.ts')).toBe(true);
    expect(ignoreNonPackagedRuntimeFiles('src/renderer/components/App.tsx')).toBe(true);
  });
});