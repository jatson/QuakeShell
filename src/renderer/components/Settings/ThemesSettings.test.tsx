// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';

vi.mock('./ThemesSettings.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

vi.mock('./ThemeCard.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

const themes = [
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    source: 'bundled' as const,
    swatchColors: ['#1a1b26', '#f7768e'],
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
  },
  {
    id: 'custom-blue',
    name: 'Custom Blue',
    source: 'community' as const,
    swatchColors: ['#101522', '#4da3ff'],
    chromeAccent: '#4da3ff',
    xtermTheme: {} as never,
    chromeTokens: {
      bgTerminal: '#101522',
      bgChrome: '#0b1020',
      fgPrimary: '#d2e5ff',
      fgDimmed: '#7a92b8',
      accent: '#4da3ff',
      border: '#24324a',
    },
  },
];

const mockThemeAPI = {
  list: vi.fn().mockResolvedValue(themes),
  getCurrent: vi.fn().mockResolvedValue('tokyo-night'),
  set: vi.fn().mockResolvedValue(undefined),
  onChanged: vi.fn(() => vi.fn()),
};

Object.defineProperty(window, 'quakeshell', {
  value: {
    theme: mockThemeAPI,
  },
  writable: true,
});

import ThemesSettings from './ThemesSettings';

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('ThemesSettings', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    mockThemeAPI.list.mockResolvedValue(themes);
    mockThemeAPI.getCurrent.mockResolvedValue('tokyo-night');
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('renders a card for each theme', async () => {
    await act(async () => {
      render(<ThemesSettings />, container);
    });
    await flush();

    expect(container.textContent).toContain('Tokyo Night');
    expect(container.textContent).toContain('Custom Blue');
  });

  it('marks the active theme card', async () => {
    await act(async () => {
      render(<ThemesSettings />, container);
    });
    await flush();

    const activeCard = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Tokyo Night'),
    ) as HTMLButtonElement;

    expect(activeCard.className).toContain('cardActive');
  });

  it('clicking a different card applies the theme', async () => {
    await act(async () => {
      render(<ThemesSettings />, container);
    });
    await flush();

    const communityCard = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Custom Blue'),
    ) as HTMLButtonElement;

    await act(async () => {
      communityCard.click();
    });

    expect(mockThemeAPI.set).toHaveBeenCalledWith('custom-blue');
  });

  it('renders bundled and community source labels', async () => {
    await act(async () => {
      render(<ThemesSettings />, container);
    });
    await flush();

    expect(container.textContent).toContain('bundled');
    expect(container.textContent).toContain('community');
  });

  it('shows a loading state while themes are fetching', async () => {
    let resolveThemes!: (value: typeof themes) => void;
    mockThemeAPI.list.mockReturnValueOnce(new Promise((resolve) => {
      resolveThemes = resolve;
    }));

    await act(async () => {
      render(<ThemesSettings />, container);
    });

    expect(container.textContent).toContain('Loading themes');
    resolveThemes(themes);
    await flush();
  });
});