import styles from './KeyCap.module.css';

interface KeyCapProps {
  label: string;
}

export default function KeyCap({ label }: KeyCapProps) {
  return <span className={styles.keycap}>{label}</span>;
}
