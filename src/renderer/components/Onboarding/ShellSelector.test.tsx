// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';

vi.mock('./ShellSelector.module.css', () => ({ default: { selector: 'selector' } }));

import ShellSelector from './ShellSelector';

describe('renderer/ShellSelector', () => {
  let container: HTMLElement;
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders PowerShell option', () => {
    act(() => {
      render(<ShellSelector value="powershell" onChange={onChange} wslAvailable={false} />, container);
    });
    const options = container.querySelectorAll('option');
    expect(options.length).toBe(1);
    expect(options[0].textContent).toBe('PowerShell');
  });

  it('renders WSL option when wslAvailable is true', () => {
    act(() => {
      render(<ShellSelector value="powershell" onChange={onChange} wslAvailable={true} />, container);
    });
    const options = container.querySelectorAll('option');
    expect(options.length).toBe(2);
    expect(options[1].textContent).toBe('WSL');
  });

  it('does not render WSL option when wslAvailable is false', () => {
    act(() => {
      render(<ShellSelector value="powershell" onChange={onChange} wslAvailable={false} />, container);
    });
    const options = container.querySelectorAll('option');
    expect(options.length).toBe(1);
  });

  it('calls onChange when selection changes', () => {
    act(() => {
      render(<ShellSelector value="powershell" onChange={onChange} wslAvailable={true} />, container);
    });
    const select = container.querySelector('select')!;
    act(() => {
      select.value = 'wsl';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith('wsl');
  });
});
