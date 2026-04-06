// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';

vi.mock('./FocusFadeToggle.module.css', () => ({
  default: { toggle: 'toggle', on: 'on', off: 'off' },
}));

import FocusFadeToggle from './FocusFadeToggle';

describe('renderer/FocusFadeToggle', () => {
  let container: HTMLElement;
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders "On" when value is true', () => {
    act(() => {
      render(<FocusFadeToggle value={true} onChange={onChange} />, container);
    });
    expect(container.querySelector('button')!.textContent).toBe('On');
  });

  it('renders "Off" when value is false', () => {
    act(() => {
      render(<FocusFadeToggle value={false} onChange={onChange} />, container);
    });
    expect(container.querySelector('button')!.textContent).toBe('Off');
  });

  it('applies on CSS class when value is true', () => {
    act(() => {
      render(<FocusFadeToggle value={true} onChange={onChange} />, container);
    });
    expect(container.querySelector('button')!.className).toContain('on');
  });

  it('applies off CSS class when value is false', () => {
    act(() => {
      render(<FocusFadeToggle value={false} onChange={onChange} />, container);
    });
    expect(container.querySelector('button')!.className).toContain('off');
  });

  it('calls onChange with toggled value on click', () => {
    act(() => {
      render(<FocusFadeToggle value={true} onChange={onChange} />, container);
    });
    act(() => {
      container.querySelector('button')!.click();
    });
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
