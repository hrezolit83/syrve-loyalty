import type { Period } from '../api';
import { cx } from '../cx';
import styles from './PeriodSwitch.module.css';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Сьогодні' },
  { value: '7d', label: '7 днів' },
  { value: '30d', label: '30 днів' },
  { value: 'all', label: 'Весь час' },
];

/**
 * Перемикач періоду — спільний для головної (Д9) і журналу транзакцій,
 * щоб обидві сторінки називали періоди однаково.
 */
export const PeriodSwitch = ({
  value,
  onChange,
  disabled = false,
}: {
  value: Period;
  onChange: (period: Period) => void;
  disabled?: boolean;
}) => (
  <div className={styles.group} role="group" aria-label="Період">
    {PERIODS.map((period) => (
      <button
        key={period.value}
        type="button"
        className={cx(styles.option, value === period.value && styles.active)}
        aria-pressed={value === period.value}
        disabled={disabled}
        onClick={() => onChange(period.value)}
      >
        {period.label}
      </button>
    ))}
  </div>
);
