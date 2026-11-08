import { UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  ApiError,
  api,
  type AdminAccount,
  type AdminRole,
} from '../api';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardForm, CardTitle } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { FormRow } from '../components/ui/FormRow';
import { Spinner } from '../components/ui/Spinner';
import { Table, Td, Th, Tr } from '../components/ui/Table';
import { cx } from '../cx';
import { formatDateTime } from '../format';
import { useAuth } from '../useAuth';
import styles from './AdminsPage.module.css';

/**
 * Д10: керування адміністраторами. Розділ бачить лише власник.
 *
 * Сторінка нічого не вирішує про права — усі заборони стоять на сервері.
 * Тут вони лише показані заздалегідь, щоб власник не тикав у кнопку,
 * яка однаково поверне помилку.
 */

const ROLE_LABELS: Record<AdminRole, string> = {
  owner: 'Власник',
  manager: 'Менеджер',
};

const PASSWORD_HINT_ID = 'new-admin-password-hint';

export const AdminsPage = () => {
  const { admin: current } = useAuth();

  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      const data = await api.admins();
      setAdmins(data.admins);
      setError(null);
    } catch (err) {
      setAdmins([]);
      setError(
        err instanceof ApiError
          ? err.message
          : 'Не вдалося завантажити адміністраторів',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Спільна обгортка: будь-яка дія над рядком однаково звітує про помилку. */
  const run = async (id: string, action: () => Promise<string>) => {
    setBusyId(id);
    setError(null);
    setSuccess(null);

    try {
      setSuccess(await action());
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Не вдалося виконати дію',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsCreating(true);

    try {
      const data = await api.createAdmin({ login: login.trim(), password, role: 'manager' });

      setSuccess(`Менеджера ${data.admin.login} створено`);
      setLogin('');
      setPassword('');
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Не вдалося створити адміністратора',
      );
    } finally {
      setIsCreating(false);
    }
  };

  const toggleRole = (account: AdminAccount) => {
    const next: AdminRole = account.role === 'owner' ? 'manager' : 'owner';

    if (
      !window.confirm(
        `Змінити роль ${account.login} на «${ROLE_LABELS[next]}»?`,
      )
    ) {
      return;
    }

    run(account.id, async () => {
      await api.updateAdmin(account.id, { role: next });
      return `Роль ${account.login}: ${ROLE_LABELS[next]}`;
    });
  };

  const toggleActive = (account: AdminAccount) => {
    const turningOff = account.isActive;

    if (
      turningOff &&
      !window.confirm(
        `Вимкнути доступ для ${account.login}?\n\nЙого поточна сесія перестане працювати одразу.`,
      )
    ) {
      return;
    }

    run(account.id, async () => {
      await api.updateAdmin(account.id, { isActive: !account.isActive });
      return turningOff
        ? `Доступ для ${account.login} вимкнено`
        : `Доступ для ${account.login} увімкнено`;
    });
  };

  const resetPassword = (account: AdminAccount) => {
    const value = window.prompt(
      `Новий пароль для ${account.login} (щонайменше 8 символів):`,
    );

    if (!value) return;

    run(account.id, async () => {
      await api.resetAdminPassword(account.id, value);
      return `Пароль для ${account.login} змінено`;
    });
  };

  return (
    <>
      <h1 className={styles.title}>Адміністратори</h1>
      <p className={styles.subtitle}>
        Власник працює без обмежень, менеджер — з лімітом на суму однієї
        операції та без доступу до цього розділу й журналу дій
      </p>

      <CardForm onSubmit={handleCreate}>
        <CardTitle>
          <UserPlus aria-hidden />
          Новий менеджер
        </CardTitle>

        <FormRow
          hintId={PASSWORD_HINT_ID}
          hint="Пароль — щонайменше 8 символів. Менеджер зможе змінити його лише через вас."
        >
          <Field
            grow
            label="Логін"
            type="text"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            autoComplete="off"
            minLength={3}
            maxLength={64}
            required
          />

          <Field
            grow
            label="Пароль"
            aria-describedby={PASSWORD_HINT_ID}
            type="text"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />

          <Button type="submit" disabled={isCreating}>
            {isCreating ? <Spinner /> : <UserPlus aria-hidden />}
            {isCreating ? 'Створюємо…' : 'Створити'}
          </Button>
        </FormRow>
      </CardForm>

      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card>
        <CardTitle>Усі адміністратори</CardTitle>

        {isLoading && admins.length === 0 ? (
          <p className={styles.subtitle}>
            <Spinner /> Завантаження…
          </p>
        ) : (
          <Table>
            <thead>
              <Tr>
                <Th>Логін</Th>
                <Th>Роль</Th>
                <Th>Доступ</Th>
                <Th>Створено</Th>
                <Th>Дії</Th>
              </Tr>
            </thead>
            <tbody>
              {admins.map((account) => {
                const isSelf = account.id === current?.id;
                const busy = busyId === account.id;

                return (
                  <Tr key={account.id} dimmed={!account.isActive}>
                    <Td nowrap>
                      {account.login}
                      {isSelf && <span className={styles.self}> — це ви</span>}
                    </Td>
                    <Td nowrap>{ROLE_LABELS[account.role]}</Td>
                    <Td nowrap>
                      {account.isActive ? (
                        <Badge status="ok">активний</Badge>
                      ) : (
                        <Badge status="fail">вимкнено</Badge>
                      )}
                    </Td>
                    <Td nowrap>{formatDateTime(account.createdAt)}</Td>
                    <Td>
                      <div className={styles.actions}>
                        {/* Власник не може ні зняти з себе роль, ні
                            вимкнути собі доступ — сервер відмовить, тому
                            кнопки просто неактивні. */}
                        <button
                          type="button"
                          className={styles.rowButton}
                          disabled={busy || isSelf}
                          onClick={() => toggleRole(account)}
                        >
                          {account.role === 'owner'
                            ? 'Зробити менеджером'
                            : 'Зробити власником'}
                        </button>

                        <button
                          type="button"
                          className={cx(styles.rowButton, account.isActive && styles.danger)}
                          disabled={busy || isSelf}
                          onClick={() => toggleActive(account)}
                        >
                          {account.isActive ? 'Вимкнути доступ' : 'Увімкнути'}
                        </button>

                        <button
                          type="button"
                          className={styles.rowButton}
                          disabled={busy}
                          onClick={() => resetPassword(account)}
                        >
                          Скинути пароль
                        </button>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
};
