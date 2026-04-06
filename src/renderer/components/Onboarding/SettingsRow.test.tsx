// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';

vi.mock('./SettingsRow.module.css', () => ({ default: { row: 'row', label: 'label' } }));

import SettingsRow from './SettingsRow';

describe('renderer/SettingsRow', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders label and children', () => {
    act(() => {
      render(
        <SettingsRow label="Shell">
          <span>PowerShell</span>
        </SettingsRow>,
        container,
      );
    });
    expect(container.querySelector('.label')!.textContent).toBe('Shell');
    expect(container.textContent).toContain('PowerShell');
  });

  it('applies the row CSS class', () => {
    act(() => {
      render(
        <SettingsRow label="Test">
          <span>value</span>
        </SettingsRow>,
        container,
      );
    });
    expect(container.querySelector('.row')).not.toBeNull();
  });
});
