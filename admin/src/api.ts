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

/** Період для статистики (Д9) і фільтра транзакцій. */
export type Period = 'today' | '7d' | '30d' | 'all';

export type StatsTotals = {
  guests: number;
  newGuests: number;
  operations: number;
  topupSum: number;
  chargeoffSum: number;
};

/** Зміна у відсотках проти попереднього періоду; null — порівнювати нема з чим. */
export type StatsChanges = {
  newGuests: number | null;
  operations: number | null;
  topupSum: number | null;
  chargeoffSum: number | null;
};

export type StatsPoint = { date: string; topup: number; chargeoff: number };

export type Stats = {
  period: Period;
  from: string | null;
  to: string;
  totals: StatsTotals;
  changes: StatsChanges | null;
  series: StatsPoint[];
};

/** Звідки прийшла транзакція: наша панель (через API) чи сам Syrve. */
export type TransactionSource = 'panel' | 'syrve';

export type Transaction = {
  id: string;
  transactionId: string;
  date: string;
  sum: number;
  balanceAfter: number | null;
  comment: string | null;
  type: string | null;
  typeName: string | null;
  source: TransactionSource;
  guest: {
    id: string;
    customerId: string | null;
    name: string | null;
    phoneFormatted: string;
  };
};

export type TransactionList = {
  transactions: Transaction[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type TransactionFilters = {
  period: Period;
  type: '' | 'topup' | 'chargeoff';
  page?: number;
};

/** Рядок запиту для журналу транзакцій — спільний для списку й експорту. */
const transactionsQuery = ({ period, type, page }: TransactionFilters) => {
  const query = new URLSearchParams({ period });

  if (type) query.set('type', type);
  if (page) query.set('page', String(page));

  return query.toString();
};

export type Admin = { id: string; login: string };

/** Рядок списку гостей (Д2) — із нашої БД, без балансу. */
export type GuestListItem = {
  id: string;
  customerId: string | null;
  name: string | null;
  phone: string;
  phoneFormatted: string;
  cardNumber: string | null;
  botBlocked: boolean;
  createdAt: string;
};

export type GuestList = {
  guests: GuestListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Guest = {
  customerId: string;
  name: string | null;
  phone: string;
  phoneFormatted: string;
  cardNumber: string | null;
  balance: number;
  registeredViaBot: boolean;
  registeredAt: string | null;
  botBlocked: boolean;
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
  /** Д9: показники головної сторінки. */
  stats: (period: Period) => request<Stats>(`/admin/stats?period=${period}`),

  transactions: (filters: TransactionFilters) =>
    request<TransactionList>(`/admin/transactions?${transactionsQuery(filters)}`),

  /**
   * Адреса експорту, а не запит: файл забирає сам браузер через <a download>.
   * Токен лежить у httpOnly cookie й їде зі звичайним переходом, тому ні
   * fetch, ні Blob тут не потрібні.
   */
  transactionsExportUrl: (filters: TransactionFilters) =>
    `/api/admin/transactions/export?${transactionsQuery({ ...filters, page: undefined })}`,

  login: (login: string, password: string) =>
    request<{ admin: Admin }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    }),

  logout: () => request<null>('/auth/logout', { method: 'POST' }),

  me: () => request<{ admin: Admin }>('/auth/me'),

  guests: (params: {
    search?: string;
    sort?: 'createdAt' | 'name';
    order?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }) => {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });

    return request<GuestList>(`/admin/guests?${query.toString()}`);
  },

  guest: (customerId: string) =>
    request<Guest>(`/admin/guests/${customerId}`),

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
