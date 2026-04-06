// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';

vi.mock('./KeyboardSettings.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

const mockConfigAPI = {
  get: vi.fn().mockResolvedValue('Ctrl+Shift+Q'),
  set: vi.fn().mockResolvedValue(undefined),
};

const mockHotkeyAPI = {
  reregister: vi.fn().mockResolvedValue({ success: true }),
};

Object.defineProperty(window, 'quakeshell', {
  value: {
    config: mockConfigAPI,
    hotkey: mockHotkeyAPI,
  },
  writable: true,
});

import KeyboardSettings from './KeyboardSettings';

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('KeyboardSettings', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('renders the current hotkey', async () => {
    await act(async () => {
      render(<KeyboardSettings />, container);
    });
    await flush();

    expect(container.textContent).toContain('Ctrl+Shift+Q');
  });

  it('shows all phase 2 shortcuts in the reference table', async () => {
    await act(async () => {
      render(<KeyboardSettings />, container);
    });
    await flush();

    expect(container.textContent).toContain('New Tab');
    expect(container.textContent).toContain('Close Tab');
    expect(container.textContent).toContain('Next Tab');
    expect(container.textContent).toContain('Previous Tab');
    expect(container.textContent).toContain('Split Pane');
    expect(container.textContent).toContain('Open Settings');
  });

  it('enters recording mode when Remap is clicked', async () => {
    await act(async () => {
      render(<KeyboardSettings />, container);
    });
    await flush();

    const remapButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Remap',
    ) as HTMLButtonElement;

    await act(async () => {
      remapButton.click();
    });

    expect(container.textContent).toContain('Press keys…');
  });

  it('cancels recording on Escape', async () => {
    await act(async () => {
      render(<KeyboardSettings />, container);
    });
    await flush();

    const remapButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Remap',
    ) as HTMLButtonElement;

    await act(async () => {
      remapButton.click();
    });
    await flush();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    });
    await flush();

    expect(container.textContent).not.toContain('Press keys…');
    expect(mockConfigAPI.set).not.toHaveBeenCalled();
  });

  it('saves a valid remapped hotkey', async () => {
    await act(async () => {
      render(<KeyboardSettings />, container);
    });
    await flush();

    const remapButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Remap',
    ) as HTMLButtonElement;

    await act(async () => {
      remapButton.click();
    });
    await flush();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        ctrlKey: true,
        shiftKey: true,
        key: 'k',
      }));
    });
    await flush();

    expect(mockConfigAPI.set).toHaveBeenCalledWith('hotkey', 'Ctrl+Shift+K');
    expect(mockHotkeyAPI.reregister).toHaveBeenCalledWith('Ctrl+Shift+K');
  });

  it('shows a warning for a known conflicting hotkey', async () => {
    await act(async () => {
      render(<KeyboardSettings />, container);
    });
    await flush();

    const remapButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Remap',
    ) as HTMLButtonElement;

    await act(async () => {
      remapButton.click();
    });
    await flush();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        ctrlKey: true,
        key: 'w',
      }));
    });
    await flush();

    expect(container.textContent).toContain('may conflict');
    expect(container.textContent).toContain('Save anyway');
    expect(mockConfigAPI.set).not.toHaveBeenCalled();
  });

  it('allows saving a conflicting hotkey anyway', async () => {
    await act(async () => {
      render(<KeyboardSettings />, container);
    });
    await flush();

    const remapButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Remap',
    ) as HTMLButtonElement;

    await act(async () => {
      remapButton.click();
    });
    await flush();

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        ctrlKey: true,
        key: 'w',
      }));
    });
    await flush();

    const saveAnywayButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Save anyway',
    ) as HTMLButtonElement;

    await act(async () => {
      saveAnywayButton.click();
    });
    await flush();

    expect(mockConfigAPI.set).toHaveBeenCalledWith('hotkey', 'Ctrl+W');
    expect(mockHotkeyAPI.reregister).toHaveBeenCalledWith('Ctrl+W');
  });
});