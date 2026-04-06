import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const globalCss = readFileSync(
  resolve(process.cwd(), 'src/renderer/global.css'),
  'utf-8',
);

describe('global.css accessibility', () => {
  it('contains @media (prefers-reduced-motion: reduce) rule', () => {
    expect(globalCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(globalCss).toContain('animation-duration: 0ms !important');
    expect(globalCss).toContain('transition-duration: 0ms !important');
  });

  it('contains @media (forced-colors: active) rule', () => {
    expect(globalCss).toContain('@media (forced-colors: active)');
    expect(globalCss).toContain('forced-color-adjust: auto');
  });

  it('overrides CSS custom properties to system colors in forced-colors', () => {
    expect(globalCss).toContain('--bg-terminal: Canvas');
    expect(globalCss).toContain('--fg-primary: CanvasText');
    expect(globalCss).toContain('--accent: Highlight');
    expect(globalCss).toContain('--border: ButtonBorder');
  });

  it('includes bold focus-visible outline in forced-colors', () => {
    expect(globalCss).toContain('outline: 2px solid Highlight !important');
    expect(globalCss).toContain('outline-offset: 2px !important');
  });
});
