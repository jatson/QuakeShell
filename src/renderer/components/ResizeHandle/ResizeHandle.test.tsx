// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';

// Mock window.quakeshell
const mockResizeStart = vi.fn();
const mockResizeEnd = vi.fn();
const mockResetHeight = vi.fn();

Object.defineProperty(window, 'quakeshell', {
  value: {
    window: { resizeStart: mockResizeStart, resizeEnd: mockResizeEnd, resetHeight: mockResetHeight },
  },
  writable: true,
});

import ResizeHandle from './ResizeHandle';

describe('renderer/ResizeHandle', () => {
  let container: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => {
      render(null, container);
    });
    document.body.removeChild(container);
  });

  it('renders with role="separator" and aria-orientation="horizontal"', () => {
    act(() => {
      render(<ResizeHandle />, container);
    });
    const separator = container.querySelector('[role="separator"]');
    expect(separator).not.toBeNull();
    expect(separator?.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('renders a grip indicator element', () => {
    act(() => {
      render(<ResizeHandle />, container);
    });
    const separator = container.querySelector('[role="separator"]');
    const grip = separator?.querySelector('div');
    expect(grip).not.toBeNull();
  });

  it('does NOT call resizeStart immediately on mousedown (waits for double-click window)', () => {
    act(() => {
      render(<ResizeHandle />, container);
    });
    const separator = container.querySelector('[role="separator"]') as HTMLElement;
    act(() => {
      separator.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    // Should not start yet — waiting for potential second click
    expect(mockResizeStart).not.toHaveBeenCalled();
  });

  it('calls resizeStart after double-click timeout expires', () => {
    act(() => {
      render(<ResizeHandle />, container);
    });
    const separator = container.querySelector('[role="separator"]') as HTMLElement;
    act(() => {
      separator.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(mockResizeStart).toHaveBeenCalledTimes(1);
  });

  it('sets userSelect=none on body when drag starts', () => {
    act(() => {
      render(<ResizeHandle />, container);
    });
    const separator = container.querySelector('[role="separator"]') as HTMLElement;
    act(() => {
      separator.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(document.body.style.userSelect).toBe('none');
  });

  it('calls resizeEnd(true) and restores userSelect on mouseup', () => {
    act(() => {
      render(<ResizeHandle />, container);
    });
    const separator = container.querySelector('[role="separator"]') as HTMLElement;
    act(() => {
      separator.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    expect(mockResizeEnd).toHaveBeenCalledWith(true);
    expect(document.body.style.userSelect).toBe('');
  });

  it('calls resetHeight on double-click (two mousedowns within 250ms)', () => {
    act(() => {
      render(<ResizeHandle />, container);
    });
    const separator = container.querySelector('[role="separator"]') as HTMLElement;
    act(() => {
      separator.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    // Second click within the window
    act(() => {
      vi.advanceTimersByTime(100);
      separator.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(mockResetHeight).toHaveBeenCalledTimes(1);
    expect(mockResizeStart).not.toHaveBeenCalled(); // drag never started
  });

  it('does not start drag on double-click', () => {
    act(() => {
      render(<ResizeHandle />, container);
    });
    const separator = container.querySelector('[role="separator"]') as HTMLElement;
    act(() => {
      separator.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    act(() => {
      separator.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    // Even after timeout, drag should not start
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(mockResizeStart).not.toHaveBeenCalled();
  });

  it('does not call resizeEnd twice if mouseup fires twice', () => {
    act(() => {
      render(<ResizeHandle />, container);
    });
    const separator = container.querySelector('[role="separator"]') as HTMLElement;
    act(() => {
      separator.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    expect(mockResizeEnd).toHaveBeenCalledTimes(1);
  });
});
