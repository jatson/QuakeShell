// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';

vi.mock('./ThemeCard.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

import ThemeCard from './ThemeCard';

const theme = {
  id: 'tokyo-night',
  name: 'Tokyo Night',
  source: 'bundled' as const,
  swatchColors: ['#1a1b26', '#f7768e', '#9ece6a'],
  chromeAccent: '#7aa2f7',
  xtermTheme: {} as never,
  chromeTokens: {
    bgTerminal: '#1a1b26',
    bgChrome: '#13141c',
    fgPrimary: '#c0caf5',
    fgDimmed: '#565f89',
    accent: '#7aa2f7',
    border: '#2a2b3d',
  },
};

describe('ThemeCard', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('renders the theme name and swatch colors', async () => {
    await act(async () => {
      render(<ThemeCard theme={theme} isActive={false} onClick={vi.fn()} />, container);
    });

    expect(container.textContent).toContain('Tokyo Night');
    expect(container.querySelectorAll('.swatchColor')).toHaveLength(3);
  });

  it('applies active styles when active', async () => {
    await act(async () => {
      render(<ThemeCard theme={theme} isActive onClick={vi.fn()} />, container);
    });

    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.className).toContain('cardActive');
    expect(button.getAttribute('aria-checked')).toBe('true');
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();

    await act(async () => {
      render(<ThemeCard theme={theme} isActive={false} onClick={onClick} />, container);
    });

    await act(async () => {
      (container.querySelector('button') as HTMLButtonElement).click();
    });

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});