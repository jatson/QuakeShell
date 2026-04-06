// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';

vi.mock('./DistributionSettings.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

vi.mock('./SettingsRow.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

const mockAppAPI = {
  getContextMenuStatus: vi.fn().mockResolvedValue({ isRegistered: false, available: true }),
  registerContextMenu: vi.fn().mockResolvedValue({ success: true }),
  deregisterContextMenu: vi.fn().mockResolvedValue({ success: true }),
};

Object.defineProperty(window, 'quakeshell', {
  value: {
    app: mockAppAPI,
  },
  writable: true,
});

import DistributionSettings from './DistributionSettings';

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('DistributionSettings', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    mockAppAPI.getContextMenuStatus.mockResolvedValue({ isRegistered: false, available: true });
    mockAppAPI.registerContextMenu.mockResolvedValue({ success: true });
    mockAppAPI.deregisterContextMenu.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('shows a loading state while status is fetching', async () => {
    let resolveStatus!: (value: { isRegistered: boolean; available: boolean }) => void;
    mockAppAPI.getContextMenuStatus.mockReturnValueOnce(new Promise((resolve) => {
      resolveStatus = resolve;
    }));

    await act(async () => {
      render(<DistributionSettings />, container);
    });

    expect(container.textContent).toContain('Checking');
    resolveStatus({ isRegistered: false, available: true });
    await flush();
  });

  it('shows register controls when not registered', async () => {
    await act(async () => {
      render(<DistributionSettings />, container);
    });
    await flush();

    expect(container.textContent).toContain('Not registered');
    expect(container.textContent).toContain('Register');
  });

  it('shows deregister controls when registered', async () => {
    mockAppAPI.getContextMenuStatus.mockResolvedValueOnce({ isRegistered: true, available: true });

    await act(async () => {
      render(<DistributionSettings />, container);
    });
    await flush();

    expect(container.textContent).toContain('Registered');
    expect(container.textContent).toContain('Deregister');
  });

  it('registers the context menu and updates status', async () => {
    await act(async () => {
      render(<DistributionSettings />, container);
    });
    await flush();

    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === 'Register',
    ) as HTMLButtonElement;

    await act(async () => {
      button.click();
    });
    await flush();

    expect(mockAppAPI.registerContextMenu).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Registered');
  });

  it('deregisters the context menu and updates status', async () => {
    mockAppAPI.getContextMenuStatus.mockResolvedValueOnce({ isRegistered: true, available: true });

    await act(async () => {
      render(<DistributionSettings />, container);
    });
    await flush();

    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === 'Deregister',
    ) as HTMLButtonElement;

    await act(async () => {
      button.click();
    });
    await flush();

    expect(mockAppAPI.deregisterContextMenu).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Not registered');
  });

  it('disables the action button while the IPC call is in flight', async () => {
    let resolveAction!: (value: { success: boolean }) => void;
    mockAppAPI.registerContextMenu.mockReturnValueOnce(new Promise((resolve) => {
      resolveAction = resolve;
    }));

    await act(async () => {
      render(<DistributionSettings />, container);
    });
    await flush();

    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === 'Register',
    ) as HTMLButtonElement;

    await act(async () => {
      button.click();
    });

    expect(container.textContent).toContain('Registering');
    expect((container.querySelector('button') as HTMLButtonElement).disabled).toBe(true);

    resolveAction({ success: true });
    await flush();
  });

  it('shows an error when registration fails and keeps the old status', async () => {
    mockAppAPI.registerContextMenu.mockResolvedValueOnce({ success: false, error: 'Registry write failed' });

    await act(async () => {
      render(<DistributionSettings />, container);
    });
    await flush();

    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent === 'Register',
    ) as HTMLButtonElement;

    await act(async () => {
      button.click();
    });
    await flush();

    expect(container.textContent).toContain('Registry write failed');
    expect(container.textContent).toContain('Not registered');
  });
});