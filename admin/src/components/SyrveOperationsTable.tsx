import type { SyrveOperation } from '../api';
import { formatAmount, formatDateTime, formatSigned } from '../format';

/**
 * Д1: усі зміни балансу гостя з боку Syrve — нарахування на касі, правки з
 * кабінету Syrve Loyalty, наші операції з панелі.
 *
 * Навмисно окремий блок від «Історії операцій»: той показує НАШ журнал
 * (який адміністратор, яка причина, включно з невдалими спробами), а цей —
 * що насправді сталося з балансом у Syrve. Назву типу показуємо як є:
 * це значення Syrve, і бачити його корисно, коли щось не збігається.
 */
export const SyrveOperationsTable = ({
  operations,
}: {
  operations: SyrveOperation[];
}) => (
  <div className="card">
    <h2>Операції в Syrve</h2>
    <p className="muted">
      Усі зміни балансу за гаманцем програми — зокрема з каси й кабінету
      Syrve Loyalty.
    </p>

    {operations.length === 0 ? (
      <p className="muted">Операцій за цим гаманцем ще не було.</p>
    ) : (
      <table>
        <thead>
          <tr>
            <th>Коли</th>
            <th className="right">Сума</th>
            <th className="right">Баланс після</th>
            <th>Коментар</th>
            <th>Тип у Syrve</th>
          </tr>
        </thead>
        <tbody>
          {operations.map((operation) => (
            <tr key={operation.id}>
              <td className="nowrap">
                {operation.whenCreated
                  ? formatDateTime(operation.whenCreated)
                  : '—'}
              </td>
              <td
                className={`right nowrap ${
                  operation.sum < 0 ? 'amount-minus' : 'amount-plus'
                }`}
              >
                {formatSigned(operation.sum)}
              </td>
              <td className="right nowrap">
                {operation.balanceAfter === null
                  ? '—'
                  : formatAmount(operation.balanceAfter)}
              </td>
              <td>{operation.comment ?? '—'}</td>
              <td className="muted nowrap">
                {operation.typeName ?? operation.type ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);
