import type { ThemeInfo } from '@shared/ipc-types';
import styles from './ThemeCard.module.css';

interface ThemeCardProps {
  theme: ThemeInfo;
  isActive: boolean;
  onClick: () => void;
}

export default function ThemeCard({ theme, isActive, onClick }: ThemeCardProps) {
  return (
    <button
      type="button"
      className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      role="radio"
      aria-checked={isActive}
    >
      <div className={styles.name}>{theme.name}</div>
      <div className={styles.source}>{theme.source}</div>
      <div className={styles.swatch}>
        {theme.swatchColors.map((color, index) => (
          <span key={`${theme.id}-${index}`} className={styles.swatchColor} style={{ background: color }} />
        ))}
      </div>
      {isActive ? <div className={styles.activeIndicator}>Active</div> : null}
    </button>
  );
}