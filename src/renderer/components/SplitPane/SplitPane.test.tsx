// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';

// Mock TerminalView to avoid xterm.js canvas dependency
vi.mock('../Terminal/TerminalView', () => ({
  TerminalView: ({ tabId }: { tabId: string }) => (
    <div data-testid={`terminal-${tabId}`} />
  ),
}));

vi.mock('./SplitPane.module.css', () => ({
  default: {
    container: 'container',
    pane: 'pane',
    divider: 'divider',
  },
}));

import SplitPane from './SplitPane';

describe('SplitPane', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders a TerminalView for each linked tab', async () => {
    await act(async () => {
      render(
        <SplitPane
          tabIds={['tab-1', 'tab-2', 'tab-3']}
          focusedPaneTabId="tab-2"
          onFocusPane={vi.fn()}
          opacity={0.85}
          fontSize={14}
          fontFamily="monospace"
        />,
        container,
      );
    });

    expect(container.querySelector('[data-testid="terminal-tab-1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="terminal-tab-2"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="terminal-tab-3"]')).toBeTruthy();
  });

  it('renders a static divider placeholder between each pane', async () => {
    await act(async () => {
      render(
        <SplitPane
          tabIds={['tab-1', 'tab-2', 'tab-3']}
          focusedPaneTabId="tab-1"
          onFocusPane={vi.fn()}
        />,
        container,
      );
    });

    const panes = container.querySelectorAll('[class*="pane"]');
    expect(panes.length).toBe(3);

    const dividers = container.querySelectorAll('[class*="divider"]');
    expect(dividers.length).toBe(2);
    expect(dividers[0]?.getAttribute('aria-hidden')).toBe('true');
  });

  it('calls onFocusPane when a pane receives focus', async () => {
    const onFocusPane = vi.fn();

    await act(async () => {
      render(
        <SplitPane
          tabIds={['tab-1', 'tab-2', 'tab-3']}
          focusedPaneTabId="tab-1"
          onFocusPane={onFocusPane}
        />,
        container,
      );
    });

    const panes = container.querySelectorAll('[class*="pane"]');
    // onFocusCapture listens for the 'focus' event in capture phase
    await act(async () => {
      panes[2].dispatchEvent(new FocusEvent('focus', { bubbles: false }));
    });

    expect(onFocusPane).toHaveBeenCalledWith('tab-3');
  });

  it('sets each pane to an equal share of the container width', async () => {
    await act(async () => {
      render(
        <SplitPane
          tabIds={['tab-1', 'tab-2', 'tab-3']}
          focusedPaneTabId="tab-1"
          onFocusPane={vi.fn()}
        />,
        container,
      );
    });

    const panes = container.querySelectorAll('[class*="pane"]') as NodeListOf<HTMLElement>;
    expect(panes[0].style.flexBasis).toBe(panes[1].style.flexBasis);
    expect(panes[1].style.flexBasis).toBe(panes[2].style.flexBasis);
    expect(panes[0].style.flexBasis).toContain('100% - 4px');
  });
});
