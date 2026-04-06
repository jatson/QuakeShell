import { useEffect, useMemo, useState } from 'preact/hooks';
import styles from './KeyboardSettings.module.css';

export const KNOWN_CONFLICTS = new Set([
  'Ctrl+C',
  'Ctrl+V',
  'Ctrl+X',
  'Ctrl+Z',
  'Ctrl+A',
  'Ctrl+S',
  'Ctrl+T',
  'Ctrl+W',
  'Ctrl+Tab',
  'Ctrl+F4',
  'Alt+F4',
  'Alt+Tab',
  'Win+L',
  'Win+D',
  'PrintScreen',
  'Escape',
]);

export function formatHotkey(event: KeyboardEvent): string | null {
  const modifiers = new Set(['Control', 'Shift', 'Alt', 'Meta']);
  if (modifiers.has(event.key)) {
    return null;
  }

  if (event.key === 'Escape') {
    return null;
  }

  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.shiftKey) parts.push('Shift');
  if (event.altKey) parts.push('Alt');
  if (event.metaKey) parts.push('Win');

  const keyMap: Record<string, string> = {
    ' ': 'Space',
    ',': ',',
    '`': '`',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
  };

  const normalizedKey = keyMap[event.key]
    ?? (event.code === 'Backquote' ? '`' : undefined)
    ?? (event.key.length === 1 ? event.key.toUpperCase() : event.key);

  parts.push(normalizedKey);
  return parts.join('+');
}

export default function KeyboardSettings() {
  const [currentHotkey, setCurrentHotkey] = useState('Ctrl+Shift+Q');
  const [isRecording, setIsRecording] = useState(false);
  const [pendingHotkey, setPendingHotkey] = useState('');
  const [conflictWarning, setConflictWarning] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let cancelled = false;

    void window.quakeshell.config.get('hotkey').then((value) => {
      if (!cancelled && typeof value === 'string') {
        setCurrentHotkey(value);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const keyboardShortcuts = useMemo(() => ([
    { action: 'Open/Close QuakeShell', shortcut: currentHotkey },
    { action: 'New Tab', shortcut: 'Ctrl+T' },
    { action: 'Close Tab', shortcut: 'Ctrl+W' },
    { action: 'Next Tab', shortcut: 'Ctrl+Tab' },
    { action: 'Previous Tab', shortcut: 'Ctrl+Shift+Tab' },
    { action: 'Switch to Tab 1–9', shortcut: 'Ctrl+1 – Ctrl+9' },
    { action: 'Split Pane', shortcut: 'Ctrl+Shift+D' },
    { action: 'Open Settings', shortcut: 'Ctrl+,' },
  ]), [currentHotkey]);

  const cancelRecording = () => {
    setIsRecording(false);
    setPendingHotkey('');
    setConflictWarning('');
  };

  const saveHotkey = async (combo: string) => {
    setSaveError('');
    await window.quakeshell.config.set('hotkey', combo);
    const result = await window.quakeshell.hotkey.reregister(combo);

    setCurrentHotkey(combo);
    setIsRecording(false);
    setPendingHotkey('');
    setConflictWarning('');

    if (!result.success) {
      setSaveError(result.error ?? 'Failed to register the new hotkey');
    }
  };

  useEffect(() => {
    if (!isRecording) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        cancelRecording();
        return;
      }

      const combo = formatHotkey(event);
      if (!combo) {
        return;
      }

      setPendingHotkey(combo);

      if (KNOWN_CONFLICTS.has(combo)) {
        setConflictWarning(`"${combo}" may conflict with Windows or app shortcuts.`);
        return;
      }

      void saveHotkey(combo);
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isRecording]);

  return (
    <div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Global Hotkey</div>
        <div className={styles.hotkeyDisplay}>
          {isRecording ? (
            <span className={styles.recording}>{pendingHotkey || 'Press keys…'}</span>
          ) : (
            <kbd className={styles.kbd}>{currentHotkey}</kbd>
          )}

          {!isRecording ? (
            <button type="button" className={styles.remapBtn} onClick={() => { setSaveError(''); setIsRecording(true); }}>
              Remap
            </button>
          ) : (
            <button type="button" className={styles.cancelBtn} onClick={cancelRecording}>
              Cancel
            </button>
          )}

          {conflictWarning ? (
            <button
              type="button"
              className={styles.saveAnywayBtn}
              onClick={() => { void saveHotkey(pendingHotkey); }}
            >
              Save anyway
            </button>
          ) : null}
        </div>

        {conflictWarning ? <div className={styles.conflictWarning}>{conflictWarning}</div> : null}
        {saveError ? <div className={styles.error}>{saveError}</div> : null}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Keyboard Reference</div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Action</th>
              <th>Shortcut</th>
            </tr>
          </thead>
          <tbody>
            {keyboardShortcuts.map((shortcut) => (
              <tr key={shortcut.action}>
                <td>{shortcut.action}</td>
                <td><kbd className={styles.kbd}>{shortcut.shortcut}</kbd></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}