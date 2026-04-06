// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';

vi.mock('./GeneralSettings.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

vi.mock('./SettingsRow.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

vi.mock('./Toggle.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

const baseConfig = {
  defaultShell: 'powershell',
  window: { heightPercent: 40, widthPercent: 100, monitor: 'active' },
  focusFade: false,
  autostart: false,
  acrylicBlur: false,
};

const mockConfigAPI = {
  get: vi.fn((key: string) => Promise.resolve(baseConfig[key as keyof typeof baseConfig])),
  set: vi.fn().mockResolvedValue(undefined),
};

const mockDisplayAPI = {
  getAll: vi.fn().mockResolvedValue([
    { id: 1, label: 'Monitor 1', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, isPrimary: true },
  ]),
};

const mockPlatformAPI = {
  isAcrylicSupported: vi.fn().mockResolvedValue(true),
};

const mockWindowAPI = {
  setAcrylicBlur: vi.fn().mockResolvedValue({ success: true }),
};

Object.defineProperty(window, 'quakeshell', {
  value: {
    config: mockConfigAPI,
    display: mockDisplayAPI,
    platform: mockPlatformAPI,
    window: mockWindowAPI,
  },
  writable: true,
});

import { hotkey } from '../../state/config-store';
import GeneralSettings from './GeneralSettings';

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('GeneralSettings', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    hotkey.value = 'Ctrl+Shift+Q';
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
    mockConfigAPI.get.mockImplementation((key: string) => Promise.resolve(baseConfig[key as keyof typeof baseConfig]));
    mockDisplayAPI.getAll.mockResolvedValue([
      { id: 1, label: 'Monitor 1', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, isPrimary: true },
    ]);
    mockPlatformAPI.isAcrylicSupported.mockResolvedValue(true);
    mockWindowAPI.setAcrylicBlur.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('renders the expected sections', async () => {
    await act(async () => {
      render(<GeneralSettings />, container);
    });
    await flush();

    expect(container.textContent).toContain('Default Shell');
    expect(container.textContent).toContain('Global Hotkey');
    expect(container.textContent).toContain('Focus Fade');
    expect(container.textContent).toContain('Autostart');
    expect(container.textContent).toContain('Terminal Height');
    expect(container.textContent).toContain('Terminal Width');
    expect(container.textContent).toContain('Monitor');
    expect(container.textContent).toContain('Acrylic Blur');
  });

  it('changing the shell dropdown saves the default shell', async () => {
    await act(async () => {
      render(<GeneralSettings />, container);
    });
    await flush();

    const select = container.querySelector('select') as HTMLSelectElement;

    await act(async () => {
      select.value = 'cmd';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(mockConfigAPI.set).toHaveBeenCalledWith('defaultShell', 'cmd');
  });

  it('toggling focus fade saves the new value', async () => {
    await act(async () => {
      render(<GeneralSettings />, container);
    });
    await flush();

    const toggles = container.querySelectorAll('input[type="checkbox"]');

    await act(async () => {
      (toggles[0] as HTMLInputElement).click();
    });

    expect(mockConfigAPI.set).toHaveBeenCalledWith('focusFade', true);
  });

  it('hides the acrylic toggle when unsupported', async () => {
    mockPlatformAPI.isAcrylicSupported.mockResolvedValue(false);

    await act(async () => {
      render(<GeneralSettings />, container);
    });
    await flush();

    expect(container.textContent).not.toContain('Acrylic Blur');
  });

  it('shows the acrylic toggle when supported', async () => {
    await act(async () => {
      render(<GeneralSettings />, container);
    });
    await flush();

    expect(container.textContent).toContain('Acrylic Blur');
  });

  it('reverts the acrylic toggle on IPC error', async () => {
    mockWindowAPI.setAcrylicBlur.mockResolvedValue({ success: false, error: 'Acrylic unsupported' });

    await act(async () => {
      render(<GeneralSettings />, container);
    });
    await flush();

    const toggles = container.querySelectorAll('input[type="checkbox"]');

    await act(async () => {
      (toggles[2] as HTMLInputElement).click();
    });
    await flush();

    expect(mockConfigAPI.set).toHaveBeenCalledWith('acrylicBlur', true);
    expect(mockConfigAPI.set).toHaveBeenCalledWith('acrylicBlur', false);
    expect(container.textContent).toContain('Acrylic unsupported');
    expect((toggles[2] as HTMLInputElement).checked).toBe(false);
  });
});