// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';

// Mock CSS modules (no longer imported but keep for safety)
vi.mock('./TabBar.module.css', () => ({
  default: {},
}));

vi.mock('./TabItem.module.css', () => ({
  default: {},
}));

const defaultTabs = [
  { id: 'tab-1', shellType: 'powershell', color: '#7aa2f7', createdAt: 1000 },
  { id: 'tab-2', shellType: 'bash', color: '#9ece6a', createdAt: 2000 },
];

const mockWindowAPI = {
  openSettings: vi.fn().mockResolvedValue(undefined),
};

// Mock window.quakeshell.tab
const mockTabAPI = {
  create: vi.fn().mockResolvedValue({
    id: 'new-tab',
    shellType: 'powershell',
    color: '#bb9af7',
    createdAt: 3000,
  }),
  close: vi.fn().mockResolvedValue(undefined),
  switchTo: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue(defaultTabs),
  input: vi.fn(),
  resize: vi.fn(),
  onData: vi.fn(() => vi.fn()),
  onClosed: vi.fn(() => vi.fn()),
  onActiveChanged: vi.fn(() => vi.fn()),
  onExited: vi.fn(() => vi.fn()),
  onRenamed: vi.fn(() => vi.fn()),
  onAutoName: vi.fn(() => vi.fn()),
  rename: vi.fn(),
};

Object.defineProperty(window, 'quakeshell', {
  value: {
    config: { getAll: vi.fn(), onConfigChange: vi.fn(() => vi.fn()) },
    terminal: {},
    tab: mockTabAPI,
    window: mockWindowAPI,
    app: {},
  },
  writable: true,
});

import TabBar from './TabBar';

/** Helper: render TabBar and flush the initial tab.list() promise */
async function renderTabBar(container: HTMLDivElement, overrideList?: unknown[]) {
  if (overrideList) {
    mockTabAPI.list.mockResolvedValueOnce(overrideList);
  }
  await act(async () => {
    render(<TabBar />, container);
    // Flush the tab.list() promise
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('TabBar', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
    mockTabAPI.list.mockResolvedValue(defaultTabs);
    mockWindowAPI.openSettings.mockResolvedValue(undefined);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('fetches tabs from IPC on mount and renders them', async () => {
    await renderTabBar(container);

    expect(mockTabAPI.list).toHaveBeenCalled();
    // Tab names rendered as text content
    expect(container.textContent).toContain('powershell');
    expect(container.textContent).toContain('bash');
  });

  it('marks the first tab as active via border style', async () => {
    await renderTabBar(container);

    // The first close button's parent-div is the active tab
    const closeButtons = container.querySelectorAll('[aria-label]');
    const closeTab1 = Array.from(closeButtons).find(
      (el) => el.getAttribute('aria-label') === 'Close powershell',
    );
    expect(closeTab1).toBeTruthy();
    const tabDiv = closeTab1!.parentElement!;
    expect(tabDiv.style.borderLeft).toContain('rgb(122, 162, 247)');
  });

  it('calls switchTo when clicking an inactive tab', async () => {
    await renderTabBar(container);

    // Click the second tab area (find it by its close button neighbor)
    const closeTab2 = container.querySelector('[aria-label="Close bash"]');
    const tabDiv = closeTab2!.parentElement!;
    await act(async () => {
      tabDiv.click();
    });

    expect(mockTabAPI.switchTo).toHaveBeenCalledWith('tab-2');
  });

  it('calls close when clicking x button and does NOT call switchTo', async () => {
    await renderTabBar(container);

    const closeBtn = container.querySelector('[aria-label="Close powershell"]') as HTMLElement;
    mockTabAPI.switchTo.mockClear();

    await act(async () => {
      closeBtn.click();
    });

    expect(mockTabAPI.close).toHaveBeenCalledWith('tab-1');
    expect(mockTabAPI.switchTo).not.toHaveBeenCalled();
  });

  it('calls create when clicking + button and adds tab to list', async () => {
    await renderTabBar(container);

    const addBtn = container.querySelector('[aria-label="New tab"]') as HTMLElement;
    await act(async () => {
      addBtn.click();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockTabAPI.create).toHaveBeenCalled();
    // New tab appears in the rendered output
    expect(container.textContent).toContain('powershell');
  });

  it('renders with a single tab', async () => {
    const singleTab = [
      { id: 'tab-1', shellType: 'powershell', color: '#7aa2f7', createdAt: 1000 },
    ];
    await renderTabBar(container, singleTab);

    expect(container.textContent).toContain('powershell');
    expect(container.querySelector('[aria-label="Close powershell"]')).toBeTruthy();
  });

  it('renders the settings button', async () => {
    await renderTabBar(container);

    const settingsBtn = container.querySelector('[aria-label="Open settings"]');
    expect(settingsBtn).toBeTruthy();
  });

  it('opens settings when clicking the settings button', async () => {
    await renderTabBar(container);

    const settingsBtn = container.querySelector('[aria-label="Open settings"]') as HTMLElement;

    await act(async () => {
      settingsBtn.click();
    });

    expect(mockWindowAPI.openSettings).toHaveBeenCalledTimes(1);
  });

  it('shows manualName when set', async () => {
    const namedTabs = [
      { id: 'tab-1', shellType: 'powershell', color: '#7aa2f7', createdAt: 1000, manualName: 'My Tab' },
    ];
    await renderTabBar(container, namedTabs);

    expect(container.textContent).toContain('My Tab');
  });

  it('renders color dots with correct colors', async () => {
    await renderTabBar(container);

    // Color dots are 8x8 spans with border-radius
    const allSpans = container.querySelectorAll('span') as NodeListOf<HTMLElement>;
    const dots = Array.from(allSpans).filter(
      (s) => s.style.borderRadius === '50%' && s.style.width === '8px',
    );
    expect(dots).toHaveLength(2);
    expect(dots[0].style.backgroundColor).toBe('rgb(122, 162, 247)');
    expect(dots[1].style.backgroundColor).toBe('rgb(158, 206, 106)');
  });
});
