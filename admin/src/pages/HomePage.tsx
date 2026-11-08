import { useCallback, useEffect, useState } from 'react';

import { ApiError, api, type Period, type Stats } from '../api';
import { OperationsChart } from '../components/OperationsChart';
import { PeriodSwitch } from '../components/PeriodSwitch';
import { StatTile } from '../components/StatTile';
import { Alert } from '../components/ui/Alert';
import { Card, CardTitle } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { formatAmount } from '../format';
import styles from './HomePage.module.css';

/**
 * Д9: головна сторінка панелі — показники закладу за обраний період.
 *
 * Числа рахуються з транзакцій, які приніс поллер (О6), а не з нашого
 * журналу ручних операцій: керівника цікавлять усі зміни балансу, зокрема
 * нарахування на касі й правки з кабінету Syrve Loyalty.
 */
export const HomePage = () => {
  const [period, setPeriod] = useState<Period>('7d');
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      setStats(await api.stats(period));
      setError(null);
    } catch (err) {
      setStats(null);
      setError(
        err instanceof ApiError
          ? err.message
          : 'Не вдалося завантажити статистику',
      );
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Головна</h1>
        <PeriodSwitch value={period} onChange={setPeriod} disabled={isLoading} />
      </div>

      {error && <Alert>{error}</Alert>}

      {/* Показники лишаються на екрані, доки вантажиться наступний період:
          інакше перемикання періоду блимало б порожньою сторінкою. */}
      {isLoading && !stats && (
        <p className={styles.loading}>
          <Spinner />
          Завантаження…
        </p>
      )}

      {stats && (
        <>
          <div className={styles.tiles}>
            <StatTile
              label="Гостей усього"
              value={formatAmount(stats.totals.guests)}
              hint="за весь час"
            />
            <StatTile
              label="Нових реєстрацій"
              value={formatAmount(stats.totals.newGuests)}
              change={stats.changes?.newGuests ?? null}
            />
            <StatTile
              label="Операцій"
              value={formatAmount(stats.totals.operations)}
              change={stats.changes?.operations ?? null}
            />
            <StatTile
              label="Нараховано бонусів"
              value={formatAmount(stats.totals.topupSum)}
              change={stats.changes?.topupSum ?? null}
            />
            <StatTile
              label="Списано бонусів"
              value={formatAmount(stats.totals.chargeoffSum)}
              change={stats.changes?.chargeoffSum ?? null}
            />
          </div>

          <Card>
            <CardTitle>Операції по днях</CardTitle>
            <OperationsChart series={stats.series} />
          </Card>
        </>
      )}
    </>
  );
};
