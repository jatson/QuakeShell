// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { h } from 'preact';

const mockSetReducedMotion = vi.fn().mockResolvedValue(undefined);

Object.defineProperty(window, 'quakeshell', {
  value: {
    config: {},
    terminal: {},
    window: { setReducedMotion: mockSetReducedMotion },
    app: {},
  },
  writable: true,
});

// Mock matchMedia
let matchMediaMatches = false;
let matchMediaListeners: Array<(e: { matches: boolean }) => void> = [];

Object.defineProperty(window, 'matchMedia', {
  value: vi.fn(() => ({
    matches: matchMediaMatches,
    addEventListener: vi.fn((_event: string, handler: (e: { matches: boolean }) => void) => {
      matchMediaListeners.push(handler);
    }),
    removeEventListener: vi.fn((_event: string, handler: (e: { matches: boolean }) => void) => {
      matchMediaListeners = matchMediaListeners.filter(h => h !== handler);
    }),
  })),
  writable: true,
});

import { useReducedMotion } from './useReducedMotion';

function TestComponent() {
  useReducedMotion();
  return h('div', null, 'test');
}

describe('useReducedMotion', () => {
  let container: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    matchMediaListeners = [];
    matchMediaMatches = false;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      render(null, container);
    });
    document.body.removeChild(container);
  });

  it('sends initial reduced-motion state to main process on mount', () => {
    matchMediaMatches = false;
    act(() => {
      render(h(TestComponent, null), container);
    });
    expect(mockSetReducedMotion).toHaveBeenCalledWith(false);
  });

  it('sends true when prefers-reduced-motion is active', () => {
    matchMediaMatches = true;
    act(() => {
      render(h(TestComponent, null), container);
    });
    expect(mockSetReducedMotion).toHaveBeenCalledWith(true);
  });

  it('reacts to runtime changes in reduced-motion preference', () => {
    matchMediaMatches = false;
    act(() => {
      render(h(TestComponent, null), container);
    });
    expect(mockSetReducedMotion).toHaveBeenCalledWith(false);

    // Simulate runtime change
    mockSetReducedMotion.mockClear();
    act(() => {
      for (const listener of matchMediaListeners) {
        listener({ matches: true });
      }
    });
    expect(mockSetReducedMotion).toHaveBeenCalledWith(true);
  });
});
