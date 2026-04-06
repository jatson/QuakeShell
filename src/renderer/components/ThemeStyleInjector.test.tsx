// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import ThemeStyleInjector from './ThemeStyleInjector';
import { activeTheme } from '../state/theme-store';

const theme = {
  id: 'retro-green',
  name: 'Retro Green',
  xtermTheme: {
    background: '#0a0f0a',
    foreground: '#33ff33',
    cursor: '#66ff66',
    cursorAccent: '#0a0f0a',
    selectionBackground: '#1a3d1a',
  },
  chromeTokens: {
    bgTerminal: '#0a0f0a',
    bgChrome: '#050805',
    fgPrimary: '#33ff33',
    fgDimmed: '#226622',
    accent: '#66ff66',
    border: '#1a3d1a',
  },
};

describe('renderer/components/ThemeStyleInjector', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    activeTheme.value = null;
    document.documentElement.style.removeProperty('--bg-terminal');
    document.documentElement.style.removeProperty('--bg-chrome');
    document.documentElement.style.removeProperty('--fg-primary');
    document.documentElement.style.removeProperty('--fg-dimmed');
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--border');

    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('renders no DOM output', () => {
    act(() => {
      render(<ThemeStyleInjector />, container);
    });

    expect(container.innerHTML).toBe('');
  });

  it('applies all chrome CSS custom properties when the theme changes', () => {
    act(() => {
      render(<ThemeStyleInjector />, container);
    });

    act(() => {
      activeTheme.value = theme;
    });

    expect(document.documentElement.style.getPropertyValue('--bg-terminal')).toBe('#0a0f0a');
    expect(document.documentElement.style.getPropertyValue('--bg-chrome')).toBe('#050805');
    expect(document.documentElement.style.getPropertyValue('--fg-primary')).toBe('#33ff33');
    expect(document.documentElement.style.getPropertyValue('--fg-dimmed')).toBe('#226622');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#66ff66');
    expect(document.documentElement.style.getPropertyValue('--border')).toBe('#1a3d1a');
  });
});