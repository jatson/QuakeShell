import { useEffect, useState } from 'preact/hooks';
import SettingsRow from './SettingsRow';
import styles from './AppearanceSettings.module.css';

export default function AppearanceSettings() {
  const [fontFamily, setFontFamily] = useState('');
  const [fontSize, setFontSize] = useState('14');
  const [lineHeight, setLineHeight] = useState('1.2');
  const [opacity, setOpacity] = useState(85);
  const [fontSizeError, setFontSizeError] = useState('');
  const [lineHeightError, setLineHeightError] = useState('');

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      window.quakeshell.config.get('fontFamily'),
      window.quakeshell.config.get('fontSize'),
      window.quakeshell.config.get('lineHeight'),
      window.quakeshell.config.get('opacity'),
    ]).then(([nextFontFamily, nextFontSize, nextLineHeight, nextOpacity]) => {
      if (cancelled) {
        return;
      }

      setFontFamily(typeof nextFontFamily === 'string' ? nextFontFamily : 'monospace');
      setFontSize(String(typeof nextFontSize === 'number' ? nextFontSize : 14));
      setLineHeight((typeof nextLineHeight === 'number' ? nextLineHeight : 1.2).toFixed(1));
      setOpacity(Math.round((typeof nextOpacity === 'number' ? nextOpacity : 0.85) * 100));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const commitFontFamily = async (value: string) => {
    const trimmed = value.trim() || 'monospace';
    setFontFamily(trimmed);
    await window.quakeshell.config.set('fontFamily', trimmed);
  };

  const commitFontSize = async (value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      return;
    }

    const clamped = Math.max(8, Math.min(48, parsed));
    setFontSizeError(parsed < 8 || parsed > 48 ? 'Font size must be between 8 and 48' : '');
    setFontSize(String(clamped));
    await window.quakeshell.config.set('fontSize', clamped);
  };

  const commitLineHeight = async (value: string) => {
    const parsed = Number.parseFloat(value);
    if (Number.isNaN(parsed)) {
      return;
    }

    const rounded = Math.round(parsed * 10) / 10;
    const clamped = Math.max(1.0, Math.min(2.0, rounded));
    setLineHeightError(parsed < 1.0 || parsed > 2.0 ? 'Line height must be between 1.0 and 2.0' : '');
    setLineHeight(clamped.toFixed(1));
    await window.quakeshell.config.set('lineHeight', clamped);
  };

  const applyOpacity = async (nextOpacity: number) => {
    setOpacity(nextOpacity);
    // Reuse the existing config hot-reload path so the live terminal updates behind the overlay.
    await window.quakeshell.config.set('opacity', nextOpacity / 100);
  };

  return (
    <div>
      <SettingsRow label="Font Family" description="Type a font name installed on your system.">
        <div>
          <input
            type="text"
            className={styles.textInput}
            value={fontFamily}
            onInput={(event) => setFontFamily((event.target as HTMLInputElement).value)}
            onBlur={(event) => { void commitFontFamily((event.target as HTMLInputElement).value); }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void commitFontFamily((event.target as HTMLInputElement).value);
              }
            }}
          />
          <div className={styles.hint}>Type a font name installed on your system</div>
        </div>
      </SettingsRow>

      <SettingsRow label="Font Size" description="Applies to all new and running terminals immediately after commit.">
        <div>
          <input
            type="number"
            min="8"
            max="48"
            step="1"
            className={styles.numberInput}
            value={fontSize}
            onInput={(event) => setFontSize((event.target as HTMLInputElement).value)}
            onBlur={(event) => { void commitFontSize((event.target as HTMLInputElement).value); }}
          />
          {fontSizeError ? <div className={styles.validationError}>{fontSizeError}</div> : null}
        </div>
      </SettingsRow>

      <SettingsRow label="Line Height" description="Use decimal values between 1.0 and 2.0.">
        <div>
          <input
            type="number"
            min="1.0"
            max="2.0"
            step="0.1"
            className={styles.numberInput}
            value={lineHeight}
            onInput={(event) => setLineHeight((event.target as HTMLInputElement).value)}
            onBlur={(event) => { void commitLineHeight((event.target as HTMLInputElement).value); }}
          />
          {lineHeightError ? <div className={styles.validationError}>{lineHeightError}</div> : null}
        </div>
      </SettingsRow>

      <SettingsRow label="Opacity" description="Preview updates live through the backdrop while you drag.">
        <div className={styles.sliderRow}>
          <input
            type="range"
            min="10"
            max="100"
            step="1"
            className={styles.slider}
            value={opacity}
            onInput={(event) => {
              const nextOpacity = Number.parseInt((event.target as HTMLInputElement).value, 10);
              void applyOpacity(nextOpacity);
            }}
            onPointerUp={(event) => {
              const nextOpacity = Number.parseInt((event.target as HTMLInputElement).value, 10);
              void applyOpacity(nextOpacity);
            }}
          />
          <span className={styles.sliderValue}>{opacity}%</span>
        </div>
      </SettingsRow>
    </div>
  );
}