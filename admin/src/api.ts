/**
 * Тонка обгортка над fetch для API панелі.
 *
 * credentials: 'include' обов'язково: JWT їде в httpOnly cookie, і без цього
 * браузер її не надсилає (ні в dev через proxy, ні в проді).
 *
 * Помилки API вже приходять українською — показуємо текст як є.
 */

export type ApiResponse<T> = {
  status: number;
  message: string;
  data: T;
};

export class ApiError extends Error {
  status: number;
  fields: { field: string; message: string }[] | null;

  constructor(
    message: string,
    status: number,
    fields: { field: string; message: string }[] | null = null,
  ) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

const request = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError('Сервер недоступний. Перевірте підключення.', 0);
  }

  let payload: ApiResponse<T> | null = null;

  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const fields = Array.isArray(payload?.data)
      ? (payload.data as { field: string; message: string }[])
      : null;

    throw new ApiError(
      payload?.message ?? 'Невідома помилка',
      response.status,
      fields,
    );
  }

  return payload!.data;
};

export type Admin = { id: string; login: string };

export type Guest = {
  customerId: string;
  name: string | null;
  phone: string;
  phoneFormatted: string;
  cardNumber: string | null;
  balance: number;
  registeredViaBot: boolean;
  registeredAt: string | null;
};

export type Operation = {
  id: string;
  type: 'topup' | 'chargeoff';
  amount: number;
  reason: string;
  status: 'success' | 'failed';
  error: string | null;
  adminLogin: string;
  createdAt: string;
};

/** Д1: зміна балансу з боку Syrve (каса, кабінет, наша панель). */
export type SyrveOperation = {
  id: string;
  revision: number;
  type: string | null;
  typeName: string | null;
  sum: number;
  balanceAfter: number | null;
  comment: string | null;
  whenCreated: string | null;
};

export type OperationResult = {
  operationId: string;
  type: 'topup' | 'chargeoff';
  amount: number;
  balanceBefore: number;
  balance: number;
};

export const api = {
  login: (login: string, password: string) =>
    request<{ admin: Admin }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    }),

  logout: () => request<null>('/auth/logout', { method: 'POST' }),

  me: () => request<{ admin: Admin }>('/auth/me'),

  searchGuest: (phone: string) =>
    request<Guest>(`/admin/guests/search?phone=${encodeURIComponent(phone)}`),

  operations: (customerId: string) =>
    request<{ operations: Operation[] }>(
      `/admin/guests/${customerId}/operations`,
    ),

  syrveOperations: (customerId: string) =>
    request<{ operations: SyrveOperation[] }>(
      `/admin/guests/${customerId}/syrve-operations`,
    ),

  applyOperation: (
    customerId: string,
    type: 'topup' | 'chargeoff',
    amount: number,
    reason: string,
  ) =>
    request<OperationResult>(`/admin/guests/${customerId}/${type}`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason }),
    }),
};
