import { LogOut } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

import { cx } from '../cx';
import { useAuth } from '../useAuth';
import { Button } from './ui/Button';
import styles from './Layout.module.css';

/** Хедер із навігацією і робоча область — спільні для всіх сторінок під входом. */
export const Layout = ({ children }: { children: ReactNode }) => {
  const { admin, logout } = useAuth();

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cx(styles.navLink, isActive && styles.active);

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <strong>Сервіс лояльності</strong>

          <nav className={styles.nav}>
            <NavLink to="/" end className={navClass}>
              Пошук
            </NavLink>
            <NavLink to="/guests" className={navClass}>
              Гості
            </NavLink>
          </nav>

          <div className={styles.topbarRight}>
            <span className={styles.login}>{admin?.login}</span>
            <Button type="button" variant="link" onClick={() => logout()}>
              <LogOut aria-hidden="true" />
              Вийти
            </Button>
          </div>
        </div>
      </header>

      <main className={styles.main}>{children}</main>
    </>
  );
};
