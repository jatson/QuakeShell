import type { ComponentChildren } from 'preact';
import styles from './SettingsRow.module.css';

interface SettingsRowProps {
  label: string;
  description?: string;
  children: ComponentChildren;
}

export default function SettingsRow({ label, description, children }: SettingsRowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.copy}>
        <label className={styles.label}>{label}</label>
        {description ? <div className={styles.description}>{description}</div> : null}
      </div>
      <div className={styles.control}>{children}</div>
    </div>
  );
}