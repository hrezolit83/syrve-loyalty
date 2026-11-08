import { cx } from '../cx';
import styles from './SegmentedSwitch.module.css';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

/**
 * Перемикач з кількох взаємовиключних значень — період, тип операції.
 *
 * Одна поведінка на всі фільтри панелі: два різні на вигляд контролі в
 * одному рядку читалися б як елементи різної природи.
 */
export const SegmentedSwitch = <T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) => (
  <div className={styles.group} role="group" aria-label={label}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        className={cx(styles.option, value === option.value && styles.active)}
        aria-pressed={value === option.value}
        disabled={disabled}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
);
