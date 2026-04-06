import { useEffect, useState } from 'preact/hooks';
import type { ContextMenuResult, ContextMenuStatus } from '@shared/ipc-types';
import SettingsRow from './SettingsRow';
import styles from './DistributionSettings.module.css';

export default function DistributionSettings() {
  const [status, setStatus] = useState<ContextMenuStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    void window.quakeshell.app.getContextMenuStatus().then((nextStatus) => {
      if (cancelled) {
        return;
      }

      setStatus(nextStatus);
      if (nextStatus.available === false) {
        setError(nextStatus.error ?? 'Feature not yet available');
      }
    }).catch((loadError: unknown) => {
      if (!cancelled) {
        setStatus({ isRegistered: false });
        setError(loadError instanceof Error ? loadError.message : 'Failed to load context menu status');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const runAction = async (action: () => Promise<ContextMenuResult>, nextRegisteredState: boolean) => {
    setIsLoading(true);
    setError('');

    try {
      const result = await action();
      if (result.success) {
        setStatus((current) => ({
          ...(current ?? { isRegistered: false }),
          isRegistered: nextRegisteredState,
        }));
        return;
      }

      setError(result.error ?? 'The context menu action failed');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unexpected context menu error');
    } finally {
      setIsLoading(false);
    }
  };

  const renderActionButton = () => {
    if (status === null) {
      return (
        <button type="button" className={styles.actionBtn} disabled>
          <span className={styles.spinner} aria-hidden="true" />
          Checking…
        </button>
      );
    }

    if (status.available === false) {
      return (
        <button type="button" className={styles.actionBtnDeregister} disabled>
          Unavailable
        </button>
      );
    }

    if (isLoading) {
      return (
        <button type="button" className={status.isRegistered ? styles.actionBtnDeregister : styles.actionBtn} disabled>
          <span className={styles.spinner} aria-hidden="true" />
          {status.isRegistered ? 'Deregistering…' : 'Registering…'}
        </button>
      );
    }

    if (status.isRegistered) {
      return (
        <button
          type="button"
          className={styles.actionBtnDeregister}
          onClick={() => { void runAction(() => window.quakeshell.app.deregisterContextMenu(), false); }}
        >
          Deregister
        </button>
      );
    }

    return (
      <button
        type="button"
        className={styles.actionBtn}
        onClick={() => { void runAction(() => window.quakeshell.app.registerContextMenu(), true); }}
      >
        Register
      </button>
    );
  };

  return (
    <div>
      <SettingsRow
        label="Explorer Context Menu"
        description='"Open QuakeShell here" entry in the Windows Explorer right-click menu.'
      >
        <div>
          <div className={styles.statusRow}>
            <span className={status?.isRegistered ? styles.badgeRegistered : styles.badgeUnregistered}>
              {status === null ? 'Checking…' : status.isRegistered ? 'Registered' : 'Not registered'}
            </span>
            {renderActionButton()}
          </div>
          {error ? <div className={styles.error}>{error}</div> : null}
        </div>
      </SettingsRow>

      <div className={styles.infoSection}>
        <div className={styles.infoTitle}>About Context Menu Registration</div>
        <p className={styles.infoText}>
          When registered, right-clicking any folder in Windows Explorer will show Open QuakeShell here, launching a terminal in that directory.
        </p>
        <p className={styles.infoText}>
          Registration writes to the per-user registry path <span className={styles.registryPath}>HKCU\Software\Classes\Directory\shell\QuakeShell</span>.
        </p>
      </div>
    </div>
  );
}