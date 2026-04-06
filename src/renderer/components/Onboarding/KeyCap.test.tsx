// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';

vi.mock('./KeyCap.module.css', () => ({ default: { keycap: 'keycap' } }));

import KeyCap from './KeyCap';

describe('renderer/KeyCap', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders the label text', () => {
    act(() => {
      render(<KeyCap label="Ctrl" />, container);
    });
    const span = container.querySelector('span');
    expect(span).not.toBeNull();
    expect(span!.textContent).toBe('Ctrl');
  });

  it('applies the keycap CSS class', () => {
    act(() => {
      render(<KeyCap label="Shift" />, container);
    });
    const span = container.querySelector('span');
    expect(span!.className).toContain('keycap');
  });

  it('renders single character keys', () => {
    act(() => {
      render(<KeyCap label="Q" />, container);
    });
    const span = container.querySelector('span');
    expect(span!.textContent).toBe('Q');
  });
});
