// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track the onConfigChange callback
let configChangeCallback: ((payload: { key: string; value: unknown; oldValue: unknown }) => void) | null = null;

// Mock window.quakeshell before importing the module
Object.defineProperty(window, 'quakeshell', {
  value: {
    config: {
      getAll: vi.fn(() =>
        Promise.resolve({
          hotkey: 'Ctrl+Shift+Q',
          defaultShell: 'powershell',
          opacity: 0.85,
          focusFade: true,
          animationSpeed: 200,
          fontSize: 14,
          fontFamily: 'Cascadia Code, Consolas, Courier New, monospace',
          lineHeight: 1.2,
          dropHeight: 40,
          autostart: true,
          firstRun: true,
          theme: 'tokyo-night',
          window: { heightPercent: 30, widthPercent: 100, monitor: 'active' },
          tabs: { colorPalette: ['#7aa2f7'], maxTabs: 10 },
          acrylicBlur: false,
        }),
      ),
      set: vi.fn(),
      onConfigChange: vi.fn((cb: (payload: { key: string; value: unknown; oldValue: unknown }) => void) => {
        configChangeCallback = cb;
        return () => {
          configChangeCallback = null;
        };
      }),
    },
    terminal: { write: vi.fn(), resize: vi.fn(), onData: vi.fn(() => vi.fn()) },
    window: { toggle: vi.fn(), onStateChanged: vi.fn(() => vi.fn()) },
    app: {},
  },
  writable: true,
});

import {
  opacity,
  animationSpeed,
  fontSize,
  fontFamily,
  lineHeight,
  hotkey,
  focusFade,
  initConfigStore,
} from './config-store';

describe('renderer/state/config-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configChangeCallback = null;
  });

  it('exports config signals with default values', () => {
    expect(opacity.value).toBe(0.85);
    expect(animationSpeed.value).toBe(200);
    expect(fontSize.value).toBe(14);
    expect(fontFamily.value).toBe('Cascadia Code, Consolas, Courier New, monospace');
    expect(lineHeight.value).toBe(1.2);
    expect(hotkey.value).toBe('Ctrl+Shift+Q');
    expect(focusFade.value).toBe(true);
  });

  it('initConfigStore populates signals from main process and subscribes to changes', async () => {
    (window.quakeshell.config.getAll as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      hotkey: 'Alt+`',
      defaultShell: 'pwsh',
      opacity: 0.7,
      focusFade: false,
      animationSpeed: 300,
      fontSize: 16,
      fontFamily: 'Fira Code',
      lineHeight: 1.35,
      dropHeight: 50,
      autostart: false,
      firstRun: false,
      theme: 'solarized-dark',
      window: { heightPercent: 30, widthPercent: 100, monitor: 'active' },
      tabs: { colorPalette: ['#7aa2f7'], maxTabs: 10 },
      acrylicBlur: false,
    });

    await initConfigStore();

    expect(opacity.value).toBe(0.7);
    expect(animationSpeed.value).toBe(300);
    expect(fontSize.value).toBe(16);
    expect(fontFamily.value).toBe('Fira Code');
    expect(lineHeight.value).toBe(1.35);
    expect(hotkey.value).toBe('Alt+`');
    expect(focusFade.value).toBe(false);
    expect(window.quakeshell.config.onConfigChange).toHaveBeenCalledWith(
      expect.any(Function),
    );
  });

  it('updates signal when config:changed event arrives', async () => {
    await initConfigStore();

    configChangeCallback?.({ key: 'opacity', value: 0.5, oldValue: 0.85 });
    expect(opacity.value).toBe(0.5);
  });

  it('updates fontSize signal on config:changed', async () => {
    await initConfigStore();

    configChangeCallback?.({ key: 'fontSize', value: 20, oldValue: 14 });
    expect(fontSize.value).toBe(20);
  });

  it('updates fontFamily signal on config:changed', async () => {
    await initConfigStore();

    configChangeCallback?.({ key: 'fontFamily', value: 'monospace', oldValue: 'Cascadia Code' });
    expect(fontFamily.value).toBe('monospace');
  });

  it('updates lineHeight signal on config:changed', async () => {
    await initConfigStore();

    configChangeCallback?.({ key: 'lineHeight', value: 1.5, oldValue: 1.2 });
    expect(lineHeight.value).toBe(1.5);
  });

  it('updates animationSpeed signal on config:changed', async () => {
    await initConfigStore();

    configChangeCallback?.({ key: 'animationSpeed', value: 400, oldValue: 200 });
    expect(animationSpeed.value).toBe(400);
  });
});
