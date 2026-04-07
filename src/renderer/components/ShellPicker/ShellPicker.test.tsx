// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { ShellPicker } from './ShellPicker';

const mockShells = [
  { id: 'powershell', label: 'Windows PowerShell', icon: '⚡' },
  { id: 'cmd', label: 'Command Prompt', icon: '▪' },
  { id: 'wsl', label: 'WSL (Linux)', icon: '🐧' },
];

const mockAvailableShells = vi.fn();

// Attach quakeshell to the existing jsdom window
Object.defineProperty(window, 'quakeshell', {
  value: {
    tab: {
      availableShells: mockAvailableShells,
    },
  },
  writable: true,
});

describe('ShellPicker', () => {
  let container: HTMLDivElement;
  const mockOnShellSelected = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
    mockAvailableShells.mockResolvedValue(mockShells);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  async function renderAndWait(props?: Partial<{ tabId: string; opacity: number }>) {
    await act(async () => {
      render(
        <ShellPicker
          tabId={props?.tabId ?? 'tab-1'}
          opacity={props?.opacity ?? 0.85}
          onShellSelected={mockOnShellSelected}
        />,
        container,
      );
    });
    // Let microtasks resolve (availableShells promise)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }

  it('renders available shells', async () => {
    await renderAndWait();
    expect(container.textContent).toContain('Windows PowerShell');
    expect(container.textContent).toContain('Command Prompt');
    expect(container.textContent).toContain('WSL (Linux)');
  });

  it('shows title text', async () => {
    await renderAndWait();
    expect(container.textContent).toContain('Choose a shell');
  });

  it('shows shortcut number badges', async () => {
    await renderAndWait();
    const badges = container.querySelectorAll('span');
    const badgeTexts = Array.from(badges).map((b) => b.textContent?.trim());
    expect(badgeTexts).toContain('1');
    expect(badgeTexts).toContain('2');
    expect(badgeTexts).toContain('3');
  });

  it('calls onShellSelected when clicking a shell', async () => {
    await renderAndWait();
    const items = container.querySelectorAll('[role="button"]');
    const psItem = Array.from(items).find(
      (el) => el.textContent?.includes('Windows PowerShell'),
    );
    expect(psItem).toBeTruthy();
    await act(() => {
      psItem!.click();
    });
    expect(mockOnShellSelected).toHaveBeenCalledWith('tab-1', 'powershell');
  });

  it('calls onShellSelected via number key press', async () => {
    await renderAndWait();
    await act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));
    });
    expect(mockOnShellSelected).toHaveBeenCalledWith('tab-1', 'cmd');
  });

  it('falls back to default shells on error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      mockAvailableShells.mockRejectedValue(new Error('fail'));
      await renderAndWait();

      expect(container.textContent).toContain('Windows PowerShell');
      expect(container.textContent).toContain('Command Prompt');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ShellPicker] availableShells() failed:',
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('shows hint text', async () => {
    await renderAndWait();
    expect(container.textContent).toContain('Press a number key or click to select');
  });
});
