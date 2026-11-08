import type { Operation } from '../api';
import { formatAmount, formatDateTime } from '../format';
import { Badge } from './ui/Badge';
import { Card, CardTitle } from './ui/Card';
import { Table, Td, Th, Tr } from './ui/Table';
import styles from './OperationsTable.module.css';

const TYPE_LABELS: Record<Operation['type'], string> = {
  topup: 'Нарахування',
  chargeoff: 'Списання',
};

/** Журнал операцій гостя. Невдалі спроби теж показуємо — це аудит. */
export const OperationsTable = ({
  operations,
}: {
  operations: Operation[];
}) => {
  if (operations.length === 0) {
    return (
      <Card>
        <CardTitle>Історія операцій</CardTitle>
        <p className={styles.empty}>Операцій ще не було.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>Історія операцій</CardTitle>

      <Table>
        <thead>
          <Tr>
            <Th>Коли</Th>
            <Th>Тип</Th>
            <Th right>Сума</Th>
            <Th>Причина</Th>
            <Th>Адміністратор</Th>
            <Th>Результат</Th>
          </Tr>
        </thead>
        <tbody>
          {operations.map((operation) => (
            <Tr key={operation.id} dimmed={operation.status === 'failed'}>
              <Td nowrap>{formatDateTime(operation.createdAt)}</Td>
              <Td>{TYPE_LABELS[operation.type]}</Td>
              <Td right nowrap>
                {operation.type === 'topup' ? '+' : '−'}
                {formatAmount(operation.amount)}
              </Td>
              <Td>{operation.reason}</Td>
              <Td>{operation.adminLogin}</Td>
              <Td>
                {operation.status === 'success' ? (
                  <Badge status="ok">виконано</Badge>
                ) : (
                  <Badge status="fail" title={operation.error ?? ''}>
                    відмова
                  </Badge>
                )}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
};
