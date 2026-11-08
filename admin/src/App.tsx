import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from 'react-router-dom';
import type { ReactNode } from 'react';

import { AuthProvider } from './auth';
import { Layout } from './components/Layout';
import { CenterScreen } from './components/ui/CenterScreen';
import { Spinner } from './components/ui/Spinner';
import { GuestPage } from './pages/GuestPage';
import { HomePage } from './pages/HomePage';
import { GuestsPage } from './pages/GuestsPage';
import { LoginPage } from './pages/LoginPage';
import { SearchPage } from './pages/SearchPage';
import { useAuth } from './useAuth';
import styles from './App.module.css';

/**
 * Без входу всі сторінки ведуть на /login.
 *
 * Поки триває перший запит /auth/me, не редіректимо: інакше при
 * перезавантаженні сторінки вже авторизований адміністратор на мить
 * побачив би форму входу.
 */
const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { admin, isLoading } = useAuth();

  if (isLoading)
    return (
      <CenterScreen className={styles.loading}>
        <Spinner />
        Завантаження…
      </CenterScreen>
    );

  if (!admin) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

/** Сторінки під автентифікацією мають однакову обгортку. */
const Protected = ({ children }: { children: ReactNode }) => (
  <RequireAuth>
    <Layout>{children}</Layout>
  </RequireAuth>
);

export const App = () => (
  <AuthProvider>
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <Protected>
              <HomePage />
            </Protected>
          }
        />

        <Route
          path="/search"
          element={
            <Protected>
              <SearchPage />
            </Protected>
          }
        />

        <Route
          path="/guests"
          element={
            <Protected>
              <GuestsPage />
            </Protected>
          }
        />

        <Route
          path="/guests/:customerId"
          element={
            <Protected>
              <GuestPage />
            </Protected>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  </AuthProvider>
);

export default App;
