import type { ComponentChildren } from 'preact';
import styles from './SettingsRow.module.css';

interface SettingsRowProps {
  label: string;
  children: ComponentChildren;
}

export default function SettingsRow({ label, children }: SettingsRowProps) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      {children}
    </div>
  );
}
