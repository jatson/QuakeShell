// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';

vi.mock('./AppearanceSettings.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

vi.mock('./SettingsRow.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

const mockConfigAPI = {
  get: vi.fn((key: string) => {
    const values: Record<string, unknown> = {
      fontFamily: 'Cascadia Code',
      fontSize: 14,
      lineHeight: 1.2,
      opacity: 0.85,
    };
    return Promise.resolve(values[key]);
  }),
  set: vi.fn().mockResolvedValue(undefined),
};

Object.defineProperty(window, 'quakeshell', {
  value: {
    config: mockConfigAPI,
  },
  writable: true,
});

import AppearanceSettings from './AppearanceSettings';

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('AppearanceSettings', () => {
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

  it('renders all four controls with loaded values', async () => {
    await act(async () => {
      render(<AppearanceSettings />, container);
    });
    await flush();

    const inputs = container.querySelectorAll('input');
    expect((inputs[0] as HTMLInputElement).value).toBe('Cascadia Code');
    expect((inputs[1] as HTMLInputElement).value).toBe('14');
    expect((inputs[2] as HTMLInputElement).value).toBe('1.2');
    expect((inputs[3] as HTMLInputElement).value).toBe('85');
  });

  it('saves the font family on Enter', async () => {
    await act(async () => {
      render(<AppearanceSettings />, container);
    });
    await flush();

    const fontFamilyInput = container.querySelector('input[type="text"]') as HTMLInputElement;

    await act(async () => {
      fontFamilyInput.value = 'JetBrains Mono';
      fontFamilyInput.dispatchEvent(new Event('input', { bubbles: true }));
      fontFamilyInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    });

    expect(mockConfigAPI.set).toHaveBeenCalledWith('fontFamily', 'JetBrains Mono');
  });

  it('clamps font size to 48 on blur', async () => {
    await act(async () => {
      render(<AppearanceSettings />, container);
    });
    await flush();

    const inputs = container.querySelectorAll('input[type="number"]');
    const fontSizeInput = inputs[0] as HTMLInputElement;

    await act(async () => {
      fontSizeInput.value = '50';
      fontSizeInput.dispatchEvent(new Event('input', { bubbles: true }));
      fontSizeInput.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    });

    expect(mockConfigAPI.set).toHaveBeenCalledWith('fontSize', 48);
    expect(fontSizeInput.value).toBe('48');
  });

  it('updates opacity live while dragging', async () => {
    await act(async () => {
      render(<AppearanceSettings />, container);
    });
    await flush();

    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;

    await act(async () => {
      slider.value = '75';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(mockConfigAPI.set).toHaveBeenCalledWith('opacity', 0.75);
  });

  it('shows a validation error for an out-of-range line height', async () => {
    await act(async () => {
      render(<AppearanceSettings />, container);
    });
    await flush();

    const inputs = container.querySelectorAll('input[type="number"]');
    const lineHeightInput = inputs[1] as HTMLInputElement;

    await act(async () => {
      lineHeightInput.value = '3.0';
      lineHeightInput.dispatchEvent(new Event('input', { bubbles: true }));
      lineHeightInput.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    });

    expect(container.textContent).toContain('Line height must be between 1.0 and 2.0');
  });
});