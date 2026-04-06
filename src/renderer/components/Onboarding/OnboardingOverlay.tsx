import { useEffect, useRef, useState } from 'preact/hooks';
import { firstRun, hotkey, opacity, defaultShell, focusFade } from '../../state/config-store';
import KeyCap from './KeyCap';
import SettingsRow from './SettingsRow';
import ShellSelector from './ShellSelector';
import OpacitySlider from './OpacitySlider';
import FocusFadeToggle from './FocusFadeToggle';
import styles from './OnboardingOverlay.module.css';

export default function OnboardingOverlay() {
  const [visible, setVisible] = useState(true);
  const [shellSelection, setShellSelection] = useState(defaultShell.value);
  const [opacityValue, setOpacityValue] = useState(opacity.value);
  const [focusFadeEnabled, setFocusFadeEnabled] = useState(focusFade.value);
  const [wslAvailable, setWslAvailable] = useState(false);

  const isFirstRun = firstRun.value;
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isFirstRun || !visible) return;

    // Async WSL detection — non-blocking
    window.quakeshell.app.checkWSL().then((available) => {
      setWslAvailable(available);
    }).catch(() => {
      setWslAvailable(false);
    });
  }, [isFirstRun, visible]);

  useEffect(() => {
    if (!isFirstRun || !visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFirstRun, visible]);

  useEffect(() => {
    if (!isFirstRun || !visible) return;

    const card = cardRef.current;
    if (!card) return;

    const focusableSelector =
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = card.querySelectorAll<HTMLElement>(focusableSelector);

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = card.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    card.addEventListener('keydown', handleTabTrap);
    return () => {
      card.removeEventListener('keydown', handleTabTrap);
    };
  }, [isFirstRun, visible]);

  if (!isFirstRun || !visible) return null;

  function handleOpacityChange(value: number) {
    setOpacityValue(value);
    // Live preview — writes to config immediately for real-time effect
    window.quakeshell.config.set('opacity', value);
  }

  function dismiss() {
    // Save all settings first, then firstRun last (atomic gate)
    window.quakeshell.config.set('defaultShell', shellSelection);
    window.quakeshell.config.set('opacity', opacityValue);
    window.quakeshell.config.set('focusFade', focusFadeEnabled);
    window.quakeshell.config.set('firstRun', false);
    setVisible(false);
  }

  const keys = hotkey.value.split('+');

  return (
    <div className={styles.backdrop}>
      <div
        ref={cardRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to QuakeShell"
        tabIndex={-1}
      >
        <h1 className={styles.title}>Welcome to QuakeShell</h1>
        <p className={styles.description}>
          Toggle your terminal anytime with:
        </p>

        <div className={styles.hotkeyDisplay}>
          {keys.map((key, i) => (
            <>
              {i > 0 && <span className={styles.separator}>+</span>}
              <KeyCap label={key} />
            </>
          ))}
        </div>

        <div className={styles.settingsSection}>
          <SettingsRow label="Shell">
            <ShellSelector
              value={shellSelection}
              onChange={setShellSelection}
              wslAvailable={wslAvailable}
            />
          </SettingsRow>
          <SettingsRow label="Opacity">
            <OpacitySlider
              value={opacityValue}
              onChange={handleOpacityChange}
            />
          </SettingsRow>
          <SettingsRow label="Focus Fade">
            <FocusFadeToggle
              value={focusFadeEnabled}
              onChange={setFocusFadeEnabled}
            />
          </SettingsRow>
        </div>

        <button className={styles.cta} onClick={dismiss} type="button">
          Start Using QuakeShell
        </button>
        <p className={styles.subtitle}>change anytime from ⚙ or tray</p>
      </div>
    </div>
  );
}
