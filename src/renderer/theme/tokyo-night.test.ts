import { describe, it, expect } from 'vitest';
import { tokyoNightTheme } from './tokyo-night';

describe('theme/tokyo-night', () => {
  it('exports a tokyoNightTheme object', () => {
    expect(tokyoNightTheme).toBeDefined();
    expect(typeof tokyoNightTheme).toBe('object');
  });

  it('defines correct background and foreground', () => {
    expect(tokyoNightTheme.background).toBe('#1a1b26');
    expect(tokyoNightTheme.foreground).toBe('#c0caf5');
  });

  it('defines correct cursor colors', () => {
    expect(tokyoNightTheme.cursor).toBe('#7aa2f7');
    expect(tokyoNightTheme.cursorAccent).toBe('#1a1b26');
  });

  it('defines correct selection background', () => {
    expect(tokyoNightTheme.selectionBackground).toBe('#283457');
  });

  it('defines complete ANSI-16 color palette', () => {
    expect(tokyoNightTheme.black).toBe('#15161e');
    expect(tokyoNightTheme.brightBlack).toBe('#414868');
    expect(tokyoNightTheme.red).toBe('#f7768e');
    expect(tokyoNightTheme.brightRed).toBe('#f7768e');
    expect(tokyoNightTheme.green).toBe('#9ece6a');
    expect(tokyoNightTheme.brightGreen).toBe('#9ece6a');
    expect(tokyoNightTheme.yellow).toBe('#e0af68');
    expect(tokyoNightTheme.brightYellow).toBe('#e0af68');
    expect(tokyoNightTheme.blue).toBe('#7aa2f7');
    expect(tokyoNightTheme.brightBlue).toBe('#7aa2f7');
    expect(tokyoNightTheme.magenta).toBe('#bb9af7');
    expect(tokyoNightTheme.brightMagenta).toBe('#bb9af7');
    expect(tokyoNightTheme.cyan).toBe('#7dcfff');
    expect(tokyoNightTheme.brightCyan).toBe('#7dcfff');
    expect(tokyoNightTheme.white).toBe('#a9b1d6');
    expect(tokyoNightTheme.brightWhite).toBe('#c0caf5');
  });

  it('has all 16 ANSI colors plus bg/fg/cursor/selection', () => {
    const requiredKeys = [
      'background', 'foreground', 'cursor', 'cursorAccent', 'selectionBackground',
      'black', 'brightBlack', 'red', 'brightRed', 'green', 'brightGreen',
      'yellow', 'brightYellow', 'blue', 'brightBlue', 'magenta', 'brightMagenta',
      'cyan', 'brightCyan', 'white', 'brightWhite',
    ];
    for (const key of requiredKeys) {
      expect(tokyoNightTheme).toHaveProperty(key);
    }
  });
});
