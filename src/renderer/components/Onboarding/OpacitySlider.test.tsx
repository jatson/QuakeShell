// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';

vi.mock('./OpacitySlider.module.css', () => ({
  default: { slider: 'slider', range: 'range', value: 'value' },
}));

import OpacitySlider from './OpacitySlider';

describe('renderer/OpacitySlider', () => {
  let container: HTMLElement;
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders range input with correct min/max/step', () => {
    act(() => {
      render(<OpacitySlider value={0.85} onChange={onChange} />, container);
    });
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.min).toBe('0.3');
    expect(input.max).toBe('1');
    expect(input.step).toBe('0.05');
  });

  it('displays current value as percentage', () => {
    act(() => {
      render(<OpacitySlider value={0.85} onChange={onChange} />, container);
    });
    expect(container.textContent).toContain('85%');
  });

  it('calls onChange on input event', () => {
    act(() => {
      render(<OpacitySlider value={0.85} onChange={onChange} />, container);
    });
    const input = container.querySelector('input[type="range"]') as HTMLInputElement;
    act(() => {
      // Simulate the input event (not change)
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '0.7');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith(0.7);
  });
});
