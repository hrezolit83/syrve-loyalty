import { useContext } from 'react';

import { AuthContext } from './authContext';

/**
 * Хук доступу до стану авторизації.
 *
 * Окремий файл, бо react-refresh вимагає, щоб модуль із компонентом
 * експортував лише компоненти — інакше гаряче перезавантаження ламається.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) throw new Error('useAuth поза AuthProvider');

  return context;
};
