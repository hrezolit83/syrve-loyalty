import { History } from 'lucide-react';

import type { Operation } from '../api';
import { formatAmount, formatDateTime } from '../format';
import { AdminCell } from './AdminCell';
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
        <CardTitle>
          <History aria-hidden="true" />
          Історія операцій
        </CardTitle>
        <p className={styles.empty}>Операцій ще не було.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>
        <History aria-hidden="true" />
        Історія операцій
      </CardTitle>

      <Table>
        <thead>
          <Tr>
            <Th>Дата</Th>
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
              <Td primary nowrap>
                {formatDateTime(operation.createdAt)}
              </Td>
              <Td label="Тип">{TYPE_LABELS[operation.type]}</Td>
              <Td primary right nowrap>
                {operation.type === 'topup' ? '+' : '−'}
                {formatAmount(operation.amount)}
              </Td>
              <Td label="Причина">{operation.reason}</Td>
              <Td label="Адміністратор">
                <AdminCell
                  login={operation.adminLogin}
                  role={operation.adminRole}
                />
              </Td>
              <Td label="Результат">
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
