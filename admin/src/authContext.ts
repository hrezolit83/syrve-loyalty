import { createContext } from 'react';

import type { Admin } from './api';

export type AuthState = {
  admin: Admin | null;
  isLoading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);
