import type { Operation } from '../api';

const TYPE_LABELS: Record<Operation['type'], string> = {
  topup: 'Нарахування',
  chargeoff: 'Списання',
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Журнал операцій гостя. Невдалі спроби теж показуємо — це аудит. */
export const OperationsTable = ({
  operations,
}: {
  operations: Operation[];
}) => {
  if (operations.length === 0) {
    return (
      <div className="card">
        <h2>Історія операцій</h2>
        <p className="muted">Операцій ще не було.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Історія операцій</h2>

      <table>
        <thead>
          <tr>
            <th>Коли</th>
            <th>Тип</th>
            <th className="right">Сума</th>
            <th>Причина</th>
            <th>Адміністратор</th>
            <th>Результат</th>
          </tr>
        </thead>
        <tbody>
          {operations.map((operation) => (
            <tr
              key={operation.id}
              className={operation.status === 'failed' ? 'row-failed' : ''}
            >
              <td className="nowrap">{formatDate(operation.createdAt)}</td>
              <td>{TYPE_LABELS[operation.type]}</td>
              <td className="right nowrap">
                {operation.type === 'topup' ? '+' : '−'}
                {operation.amount}
              </td>
              <td>{operation.reason}</td>
              <td>{operation.adminLogin}</td>
              <td>
                {operation.status === 'success' ? (
                  <span className="badge badge-ok">виконано</span>
                ) : (
                  <span className="badge badge-fail" title={operation.error ?? ''}>
                    відмова
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
