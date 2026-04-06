import styles from './FocusFadeToggle.module.css';

interface FocusFadeToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export default function FocusFadeToggle({ value, onChange }: FocusFadeToggleProps) {
  return (
    <button
      type="button"
      className={`${styles.toggle} ${value ? styles.on : styles.off}`}
      onClick={() => onChange(!value)}
    >
      {value ? 'On' : 'Off'}
    </button>
  );
}
