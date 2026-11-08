import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';

import { ApiError } from '../api';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { CardForm } from '../components/ui/Card';
import { CenterScreen } from '../components/ui/CenterScreen';
import { Field } from '../components/ui/Field';
import { useAuth } from '../useAuth';
import styles from './LoginPage.module.css';

export const LoginPage = () => {
  const { admin, login } = useAuth();
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (admin) return <Navigate to="/" replace />;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(loginValue.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Не вдалося увійти',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CenterScreen>
      <CardForm className={styles.form} onSubmit={handleSubmit}>
        <h1 className={styles.title}>Вхід у панель</h1>
        <p className={styles.subtitle}>Сервіс лояльності</p>

        <Field
          label="Логін"
          type="text"
          value={loginValue}
          onChange={(event) => setLoginValue(event.target.value)}
          autoComplete="username"
          autoFocus
          required
        />

        <Field
          label="Пароль"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />

        {error && <Alert>{error}</Alert>}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Входимо…' : 'Увійти'}
        </Button>
      </CardForm>
    </CenterScreen>
  );
};
