import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { api, type Admin } from './api';
import { AuthContext } from './authContext';

/**
 * Стан авторизації.
 *
 * Токен лежить у httpOnly cookie, тому JS його не бачить і не може зберегти
 * в localStorage. Єдиний спосіб дізнатися, чи ми ввійшли — спитати сервер
 * (GET /api/auth/me). Саме це й робимо один раз на старті.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((data) => setAdmin(data.admin))
      .catch(() => setAdmin(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (loginValue: string, password: string) => {
    const data = await api.login(loginValue, password);
    setAdmin(data.admin);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setAdmin(null);
  }, []);

  const value = useMemo(
    () => ({ admin, isLoading, login, logout }),
    [admin, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
