// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';

// Mock CSS modules
vi.mock('./OnboardingOverlay.module.css', () => ({
  default: {
    backdrop: 'backdrop',
    card: 'card',
    title: 'title',
    description: 'description',
    hotkeyDisplay: 'hotkeyDisplay',
    separator: 'separator',
    settingsSection: 'settingsSection',
    cta: 'cta',
    subtitle: 'subtitle',
  },
}));
vi.mock('./KeyCap.module.css', () => ({ default: { keycap: 'keycap' } }));

// Mock config-store signals
const mockSignals = vi.hoisted(() => ({
  firstRun: { value: true },
  hotkey: { value: 'Ctrl+Shift+Q' },
  opacity: { value: 0.85 },
  defaultShell: { value: 'powershell' },
  focusFade: { value: true },
}));
vi.mock('../../state/config-store', () => mockSignals);

// Mock window.quakeshell
const mockConfigSet = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(window, 'quakeshell', {
  value: {
    config: {
      getAll: vi.fn(),
      set: mockConfigSet,
      onConfigChange: vi.fn(() => vi.fn()),
    },
    terminal: {},
    window: {},
    app: {
      checkWSL: vi.fn().mockResolvedValue(false),
    },
  },
  writable: true,
});

import OnboardingOverlay from './OnboardingOverlay';

describe('renderer/OnboardingOverlay', () => {
  let container: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    mockSignals.firstRun.value = true;
    mockSignals.hotkey.value = 'Ctrl+Shift+Q';
  });

  afterEach(() => {
    render(null, container);
    document.body.removeChild(container);
  });

  it('renders overlay when firstRun is true', () => {
    act(() => {
      render(<OnboardingOverlay />, container);
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('does NOT render when firstRun is false', () => {
    mockSignals.firstRun.value = false;
    act(() => {
      render(<OnboardingOverlay />, container);
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('has correct ARIA attributes', () => {
    act(() => {
      render(<OnboardingOverlay />, container);
    });
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
    expect(dialog!.getAttribute('aria-label')).toBe('Welcome to QuakeShell');
  });

  it('renders hotkey as 3 KeyCap components with separators', () => {
    act(() => {
      render(<OnboardingOverlay />, container);
    });
    const keycaps = container.querySelectorAll('.keycap');
    expect(keycaps.length).toBe(3);
    expect(keycaps[0].textContent).toBe('Ctrl');
    expect(keycaps[1].textContent).toBe('Shift');
    expect(keycaps[2].textContent).toBe('Q');

    // Check + separators exist
    const hotkeyDisplay = container.querySelector('.hotkeyDisplay');
    const separators = hotkeyDisplay!.querySelectorAll('.separator');
    expect(separators.length).toBe(2);
  });

  it('renders CTA button with correct text', () => {
    act(() => {
      render(<OnboardingOverlay />, container);
    });
    const button = container.querySelector('button.cta');
    expect(button).not.toBeNull();
    expect(button!.textContent).toBe('Start Using QuakeShell');
  });

  it('renders subtitle text', () => {
    act(() => {
      render(<OnboardingOverlay />, container);
    });
    const subtitle = container.querySelector('.subtitle');
    expect(subtitle).not.toBeNull();
    expect(subtitle!.textContent).toContain('change anytime from');
  });

  it('clicking CTA calls config.set(firstRun, false) and hides overlay', () => {
    act(() => {
      render(<OnboardingOverlay />, container);
    });
    const button = container.querySelector('button.cta')!;
    act(() => {
      button.click();
    });
    expect(mockConfigSet).toHaveBeenCalledWith('firstRun', false);
    // Overlay should be gone
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('pressing Escape dismisses the overlay', () => {
    act(() => {
      render(<OnboardingOverlay />, container);
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(mockConfigSet).toHaveBeenCalledWith('firstRun', false);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('backdrop has the correct CSS class', () => {
    act(() => {
      render(<OnboardingOverlay />, container);
    });
    const backdrop = container.querySelector('.backdrop');
    expect(backdrop).not.toBeNull();
  });

  describe('accessibility', () => {
    it('renders with role="dialog", aria-modal, and aria-label', () => {
      act(() => {
        render(<OnboardingOverlay />, container);
      });
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog?.getAttribute('aria-modal')).toBe('true');
      expect(dialog?.getAttribute('aria-label')).toBe('Welcome to QuakeShell');
    });

    it('has tabIndex=-1 on the card for focus management', () => {
      act(() => {
        render(<OnboardingOverlay />, container);
      });
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog?.getAttribute('tabindex')).toBe('-1');
    });

    it('focuses the first focusable element on mount', () => {
      act(() => {
        render(<OnboardingOverlay />, container);
      });
      const focusable = container.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      // The first focusable child should have focus (e.g. a select or button)
      expect(focusable.length).toBeGreaterThan(0);
    });

    it('traps focus within the dialog on Tab at last element', () => {
      act(() => {
        render(<OnboardingOverlay />, container);
      });

      const dialog = container.querySelector('[role="dialog"]');
      const focusable = dialog?.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const last = focusable[focusable.length - 1];
      const first = focusable[0];

      // Focus last element
      last.focus();

      // Tab should cycle to first
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        dialog?.dispatchEvent(tabEvent);
      });

      expect(document.activeElement).toBe(first);
    });

    it('traps focus within the dialog on Shift+Tab at first element', () => {
      act(() => {
        render(<OnboardingOverlay />, container);
      });

      const dialog = container.querySelector('[role="dialog"]');
      const focusable = dialog?.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      // Focus first element
      first.focus();

      // Shift+Tab should cycle to last
      const shiftTabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        dialog?.dispatchEvent(shiftTabEvent);
      });

      expect(document.activeElement).toBe(last);
    });
  });
});
