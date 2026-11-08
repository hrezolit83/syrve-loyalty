import { History } from 'lucide-react';

import type { SyrveOperation } from '../api';
import { formatAmount, formatDateTime, formatSigned } from '../format';
import { Card, CardTitle } from './ui/Card';
import { Table, Td, Th, Tr } from './ui/Table';
import styles from './SyrveOperationsTable.module.css';

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
  <Card>
    <CardTitle>
      <History aria-hidden="true" />
      Операції в Syrve
    </CardTitle>
    <p className={styles.hint}>
      Усі зміни балансу за гаманцем програми — зокрема з каси й кабінету
      Syrve Loyalty.
    </p>

    {operations.length === 0 ? (
      <p className={styles.empty}>Операцій за цим гаманцем ще не було.</p>
    ) : (
      <Table>
        <thead>
          <Tr>
            <Th>Коли</Th>
            <Th right>Сума</Th>
            <Th right>Баланс після</Th>
            <Th>Коментар</Th>
            <Th>Тип у Syrve</Th>
          </Tr>
        </thead>
        <tbody>
          {operations.map((operation) => (
            <Tr key={operation.id}>
              <Td primary nowrap>
                {operation.whenCreated
                  ? formatDateTime(operation.whenCreated)
                  : '—'}
              </Td>
              <Td
                primary
                right
                nowrap
                className={
                  operation.sum < 0 ? styles.amountMinus : styles.amountPlus
                }
              >
                {formatSigned(operation.sum)}
              </Td>
              <Td label="Баланс після" right nowrap>
                {operation.balanceAfter === null
                  ? '—'
                  : formatAmount(operation.balanceAfter)}
              </Td>
              <Td label="Коментар">{operation.comment ?? '—'}</Td>
              <Td label="Тип у Syrve" muted nowrap>
                {operation.typeName ?? operation.type ?? '—'}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    )}
  </Card>
);
