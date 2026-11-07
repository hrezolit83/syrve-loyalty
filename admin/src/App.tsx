import {
  Navigate,
  NavLink,
  Route,
  BrowserRouter as Router,
  Routes,
} from 'react-router-dom';
import type { ReactNode } from 'react';

import { AuthProvider } from './auth';
import { GuestPage } from './pages/GuestPage';
import { GuestsPage } from './pages/GuestsPage';
import { LoginPage } from './pages/LoginPage';
import { SearchPage } from './pages/SearchPage';
import { useAuth } from './useAuth';

/**
 * Без входу всі сторінки ведуть на /login.
 *
 * Поки триває перший запит /auth/me, не редіректимо: інакше при
 * перезавантаженні сторінки вже авторизований адміністратор на мить
 * побачив би форму входу.
 */
const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { admin, isLoading } = useAuth();

  if (isLoading) return <div className="center-screen muted">Завантаження…</div>;

  if (!admin) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

const Layout = ({ children }: { children: ReactNode }) => {
  const { admin, logout } = useAuth();

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <strong>Сервіс лояльності</strong>

          <nav className="nav">
            <NavLink to="/" end>
              Пошук
            </NavLink>
            <NavLink to="/guests">Гості</NavLink>
          </nav>

          <div className="topbar-right">
            <span className="muted">{admin?.login}</span>
            <button type="button" className="link" onClick={() => logout()}>
              Вийти
            </button>
          </div>
        </div>
      </header>

      <main className="container">{children}</main>
    </>
  );
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
