import styles from './OpacitySlider.module.css';

interface OpacitySliderProps {
  value: number;
  onChange: (value: number) => void;
}

export default function OpacitySlider({ value, onChange }: OpacitySliderProps) {
  return (
    <div className={styles.slider}>
      <input
        className={styles.range}
        type="range"
        min={0.3}
        max={1.0}
        step={0.05}
        value={value}
        onInput={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))}
      />
      <span className={styles.value}>{Math.round(value * 100)}%</span>
    </div>
  );
}
