import {
  ArrowLeftRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { cx } from '../cx';
import { useAuth } from '../useAuth';
import { Button } from './ui/Button';
import styles from './Layout.module.css';

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ 'aria-hidden'?: boolean }>;
  /** Шлях головної — початок усіх інших, тому порівнюється точно. */
  end?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Головна', icon: LayoutDashboard, end: true },
  { to: '/guests', label: 'Клієнти', icon: Users },
  { to: '/transactions', label: 'Транзакції', icon: ArrowLeftRight },
  { to: '/search', label: 'Пошук гостя', icon: Search },
];

/**
 * Каркас панелі: бокове меню й робоча область.
 *
 * На вузькому екрані меню ховається за кнопку-бургер і виїжджає поверх
 * вмісту: колонка в 240px на телефоні не лишила б місця для таблиць.
 */
export const Layout = ({ children }: { children: ReactNode }) => {
  const { admin, logout } = useAuth();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Перехід у інший розділ закриває меню: інакше на телефоні воно лишалося б
  // розгорнутим поверх сторінки, на яку щойно перейшли.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className={styles.layout}>
      <aside className={cx(styles.sidebar, isMenuOpen && styles.sidebarOpen)}>
        <strong className={styles.brand}>
          <Sparkles aria-hidden />
          Сервіс лояльності
        </strong>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(styles.navLink, isActive && styles.active)
              }
            >
              <item.icon aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Клік повз меню закриває його. Кнопка, а не div: так це працює
          і з клавіатури, і для скрінрідера. */}
      {isMenuOpen && (
        <button
          type="button"
          className={styles.overlay}
          aria-label="Закрити меню"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className={styles.content}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.burger}
            aria-label="Меню"
            aria-expanded={isMenuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Menu aria-hidden="true" />
          </button>

          <div className={styles.topbarRight}>
            <span className={styles.login}>{admin?.login}</span>
            <Button type="button" variant="link" onClick={() => logout()}>
              <LogOut aria-hidden="true" />
              Вийти
            </Button>
          </div>
        </header>

        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
};
