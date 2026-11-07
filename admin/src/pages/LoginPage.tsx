import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';

import { ApiError } from '../api';
import { useAuth } from '../useAuth';

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
    <div className="center-screen">
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1>Вхід у панель</h1>
        <p className="muted">Сервіс лояльності</p>

        <label>
          Логін
          <input
            type="text"
            value={loginValue}
            onChange={(event) => setLoginValue(event.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </label>

        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <div className="alert alert-error">{error}</div>}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Входимо…' : 'Увійти'}
        </button>
      </form>
    </div>
  );
};
