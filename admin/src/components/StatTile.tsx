import { cx } from '../cx';
import { Card } from './ui/Card';
import styles from './StatTile.module.css';

type StatTileProps = {
  label: string;
  value: string;
  /** Зміна у відсотках проти попереднього періоду; null — порівняння немає. */
  change?: number | null;
  /** Підпис під значенням, коли порівняння не буває (наприклад, «усього»). */
  hint?: string;
};

/**
 * Показник на головній.
 *
 * Зміну показуємо лише тоді, коли попередній період справді був і не був
 * нульовим: «+100%» після нуля — число без змісту.
 */
export const StatTile = ({ label, value, change, hint }: StatTileProps) => (
  <Card className={styles.tile}>
    <span className={styles.label}>{label}</span>
    <strong className={styles.value}>{value}</strong>

    {change === null || change === undefined ? (
      <span className={styles.change}>{hint ?? 'немає з чим порівняти'}</span>
    ) : (
      <span
        className={cx(
          styles.change,
          change > 0 && styles.up,
          change < 0 && styles.down,
        )}
      >
        {change > 0 ? '▲ +' : change < 0 ? '▼ ' : ''}
        {change}% до попереднього періоду
      </span>
    )}
  </Card>
);
