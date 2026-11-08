import type { Period } from '../api';
import { SegmentedSwitch, type SegmentedOption } from './SegmentedSwitch';

const PERIODS: SegmentedOption<Period>[] = [
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
  <SegmentedSwitch
    label="Період"
    options={PERIODS}
    value={value}
    onChange={onChange}
    disabled={disabled}
  />
);
