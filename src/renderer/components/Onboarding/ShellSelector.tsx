import styles from './ShellSelector.module.css';

interface ShellSelectorProps {
  value: string;
  onChange: (shell: string) => void;
  wslAvailable: boolean;
}

export default function ShellSelector({ value, onChange, wslAvailable }: ShellSelectorProps) {
  return (
    <select
      className={styles.selector}
      value={value}
      onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
    >
      <option value="powershell">PowerShell</option>
      {wslAvailable && <option value="wsl">WSL</option>}
    </select>
  );
}
