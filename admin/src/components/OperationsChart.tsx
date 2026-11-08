import type { StatsPoint } from '../api';
import { formatDayLabel, formatDayLong } from '../format';
import styles from './OperationsChart.module.css';

/**
 * Операції по днях.
 *
 * Зроблено на CSS без бібліотек графіків: даних тут небагато (до 30 діб,
 * два ряди), а будь-яка бібліотека потягнула б у бандл більше, ніж важить
 * уся панель.
 *
 * Колірна пара навмисно не «зелене/червоне»: для дейтеранопії ці два
 * кольори зливаються. Крім кольору, ряди розрізняються позицією (ліворуч —
 * нарахування, праворуч — списання), легендою і підказкою, тож колір тут
 * не єдине джерело сенсу.
 */

/** Скільки підписів осі показувати, щоб вони не наїжджали один на одного. */
const MAX_TICKS = 8;

export const OperationsChart = ({ series }: { series: StatsPoint[] }) => {
  const max = Math.max(...series.map((day) => Math.max(day.topup, day.chargeoff)), 0);

  if (max === 0) {
    return (
      <p className={styles.empty}>
        За цей період операцій не було — графік порожній.
      </p>
    );
  }

  // Ненульовий день має лишитися видимим, навіть якщо він у сто разів
  // менший за максимум, тому в нього є мінімальна висота.
  const height = (value: number) =>
    value === 0 ? '0' : `max(3px, ${(value / max) * 100}%)`;

  const tickStep = Math.max(1, Math.ceil(series.length / MAX_TICKS));

  return (
    <div className={styles.chart}>
      <ul className={styles.legend}>
        <li className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchTopup}`} />
          Нарахування
        </li>
        <li className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchChargeoff}`} />
          Списання
        </li>
      </ul>

      <p className={styles.scale}>Максимум за добу: {max}</p>

      <ul className={styles.plot}>
        {series.map((day) => (
          <li
            key={day.date}
            className={styles.day}
            tabIndex={0}
            aria-label={`${formatDayLong(day.date)}: нарахувань ${day.topup}, списань ${day.chargeoff}`}
          >
            <span
              className={`${styles.bar} ${styles.barTopup}`}
              style={{ height: height(day.topup) }}
            />
            <span
              className={`${styles.bar} ${styles.barChargeoff}`}
              style={{ height: height(day.chargeoff) }}
            />

            <span className={styles.tooltip} aria-hidden="true">
              <span className={styles.tooltipDate}>
                {formatDayLong(day.date)}
              </span>
              Нарахувань: {day.topup}
              <br />
              Списань: {day.chargeoff}
            </span>
          </li>
        ))}
      </ul>

      <ul className={styles.axis} aria-hidden="true">
        {series.map((day, index) => (
          <li key={day.date} className={styles.tick}>
            {index % tickStep === 0 ? formatDayLabel(day.date) : ''}
          </li>
        ))}
      </ul>
    </div>
  );
};
