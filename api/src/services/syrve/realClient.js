import {
  SYRVE_REQUEST_TIMEOUT_MS,
  SYRVE_TOKEN_REFRESH_MARGIN_MS,
  SYRVE_TOKEN_TTL_MS,
} from '../../constants/index.js';
import { logger } from '../../utils/logger.js';
import {
  SyrveAuthError,
  SyrveError,
  SyrveNotFoundError,
  SyrveUnavailableError,
  SyrveValidationError,
} from './errors.js';
import { SyrveClient } from './types.js';

/**
 * Справжній клієнт Syrve Cloud API.
 *
 * Що бере на себе:
 *  - токен: отримання за apiLogin, кеш у пам'яті процесу, оновлення за 5 хв
 *    до кінця години і один повтор запиту при 401;
 *  - таймаути: жоден запит не вішає сервіс довше за SYRVE_REQUEST_TIMEOUT_MS;
 *  - нормалізацію помилок у типи з errors.js;
 *  - кеш організації та програми: вони не змінюються під час роботи сервісу.
 *
 * Чого не робить: не логує apiLogin і токен. Syrve повторює apiLogin у тексті
 * помилки 401, тому текст від Syrve у лог не потрапляє — тільки статус,
 * correlationId і наше повідомлення.
 */
export class RealSyrveClient extends SyrveClient {
  #apiUrl;
  #apiLogin;
  #organizationId;
  #programId;

  /** Кеш токена: значення + час, коли його треба замінити. */
  #token = null;
  #tokenExpiresAt = 0;
  /** Запит токена, що вже летить: щоб паралельні виклики не плодили токени. */
  #tokenRequest = null;

  #organization = null;
  #program = null;

  constructor({ apiUrl, apiLogin, organizationId, programId }) {
    super();

    if (!apiLogin) {
      throw new Error('SYRVE_MODE=real вимагає заповненого SYRVE_API_LOGIN');
    }

    this.#apiUrl = String(apiUrl).replace(/\/+$/, '');
    this.#apiLogin = apiLogin;
    this.#organizationId = organizationId || null;
    this.#programId = programId || null;
  }

  get mode() {
    return 'real';
  }

  // ---------- токен ----------

  async #fetchToken() {
    const url = `${this.#apiUrl}/api/1/access_token`;

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiLogin: this.#apiLogin }),
        signal: AbortSignal.timeout(SYRVE_REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      throw new SyrveUnavailableError(
        'Не вдалося звернутися до Syrve за токеном',
        { cause },
      );
    }

    const payload = await this.#parseBody(response);

    if (!response.ok) {
      // 401 тут означає саме непридатний ключ, а не протермінований токен.
      throw new SyrveAuthError(
        'Syrve не прийняв ключ доступу (перевір SYRVE_API_LOGIN)',
        {
          status: response.status,
          correlationId: payload?.correlationId ?? null,
        },
      );
    }

    const token =
      typeof payload === 'string' ? payload : (payload?.token ?? null);

    if (!token) {
      throw new SyrveError('Syrve не повернув токен', {
        status: response.status,
      });
    }

    return token;
  }

  /**
   * Токен із кешу або новий. force=true — примусове оновлення (після 401).
   * Паралельні виклики чекають на один і той самий запит.
   */
  async #getToken({ force = false } = {}) {
    const isValid = this.#token && Date.now() < this.#tokenExpiresAt;

    if (!force && isValid) return this.#token;

    if (!this.#tokenRequest) {
      this.#tokenRequest = this.#fetchToken()
        .then((token) => {
          this.#token = token;
          // Живе годину; оновлюємо за 5 хв до кінця, щоб запит не впав на межі.
          this.#tokenExpiresAt =
            Date.now() + SYRVE_TOKEN_TTL_MS - SYRVE_TOKEN_REFRESH_MARGIN_MS;
          logger.info('Syrve: отримано токен доступу');
          return token;
        })
        .finally(() => {
          this.#tokenRequest = null;
        });
    }

    return this.#tokenRequest;
  }

  // ---------- запити ----------

  async #parseBody(response) {
    const text = await response.text();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  /**
   * Перетворює відповідь Syrve на нормалізовану помилку.
   * Текст від Syrve клієнтові не показуємо (у ньому буває apiLogin),
   * але correlationId зберігаємо — за ним Syrve знайде запит у своїх логах.
   */
  #toError(response, payload) {
    const correlationId = payload?.correlationId ?? null;
    const description =
      typeof payload === 'string' ? payload : (payload?.errorDescription ?? '');
    const options = { status: response.status, correlationId };

    if (response.status === 401 || response.status === 403) {
      return new SyrveAuthError(
        'Syrve відмовив в авторизації (перевір SYRVE_API_LOGIN і права ключа)',
        options,
      );
    }

    if (response.status === 404 || /not\s*found|не\s*найден/i.test(description)) {
      return new SyrveNotFoundError('Syrve не знайшов запис', options);
    }

    if (response.status >= 500) {
      return new SyrveUnavailableError('Syrve відповів помилкою сервера', options);
    }

    if (response.status === 429) {
      return new SyrveUnavailableError(
        'Syrve обмежив частоту запитів, спробуй пізніше',
        options,
      );
    }

    return new SyrveValidationError('Syrve відхилив запит', options);
  }

  /**
   * POST до Syrve з токеном. На 401 робить РІВНО один повтор зі свіжим
   * токеном: якщо ключ взагалі непридатний, повтор нічого не змінить,
   * а нескінченний цикл ми собі дозволити не можемо.
   */
  async #request(path, body, { isRetry = false } = {}) {
    const token = await this.#getToken({ force: isRetry });
    const url = `${this.#apiUrl}${path}`;
    const startedAt = Date.now();

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(SYRVE_REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      const isTimeout = cause?.name === 'TimeoutError';
      throw new SyrveUnavailableError(
        isTimeout
          ? `Syrve не відповів за ${SYRVE_REQUEST_TIMEOUT_MS / 1000} с`
          : 'Не вдалося звернутися до Syrve',
        { cause },
      );
    }

    const payload = await this.#parseBody(response);

    if (response.status === 401 && !isRetry) {
      logger.warn('Syrve: 401, оновлюю токен і повторюю запит');
      return this.#request(path, body, { isRetry: true });
    }

    logger.debug(
      { path, status: response.status, ms: Date.now() - startedAt },
      'Syrve: запит виконано',
    );

    if (!response.ok) throw this.#toError(response, payload);

    return payload;
  }

  // ---------- організація і програма ----------

  async getOrganization() {
    if (this.#organization) return this.#organization;

    const payload = await this.#request('/api/1/organizations', {
      returnAdditionalInfo: false,
      includeDisabled: false,
    });

    const organizations = payload?.organizations ?? [];

    if (organizations.length === 0) {
      throw new SyrveNotFoundError(
        'Ключу недоступна жодна організація Syrve',
      );
    }

    // id з .env має пріоритет; без нього беремо першу доступну.
    const organization = this.#organizationId
      ? organizations.find((org) => org.id === this.#organizationId)
      : organizations[0];

    if (!organization) {
      throw new SyrveNotFoundError(
        `Організацію ${this.#organizationId} не знайдено серед доступних ключу`,
      );
    }

    this.#organization = { id: organization.id, name: organization.name };
    return this.#organization;
  }

  async #getOrganizationId() {
    const organization = await this.getOrganization();
    return organization.id;
  }

  async getProgram() {
    if (this.#program) return this.#program;

    const organizationId = await this.#getOrganizationId();

    const payload = await this.#request('/api/1/loyalty/syrve/program', {
      organizationId,
    });

    // Syrve у різних версіях відповідає то programs, то Programs.
    const raw = payload?.programs ?? payload?.Programs ?? [];

    const programs = raw.map((program) => ({
      id: program.id ?? program.Id,
      name: program.name ?? program.Name,
      walletId: program.walletId ?? program.WalletId,
      isActive: (program.isActive ?? program.IsActive) === true,
    }));

    if (programs.length === 0) {
      throw new SyrveNotFoundError(
        'В організації немає програм лояльності — створи програму в кабінеті Syrve Loyalty',
      );
    }

    // programId з .env має пріоритет; без нього — перша активна.
    const program = this.#programId
      ? programs.find((item) => item.id === this.#programId)
      : (programs.find((item) => item.isActive) ?? programs[0]);

    if (!program) {
      throw new SyrveNotFoundError(
        `Програму ${this.#programId} не знайдено в організації`,
      );
    }

    this.#program = program;
    return this.#program;
  }

  async checkConnection() {
    await this.#getToken();
    const organization = await this.getOrganization();
    const program = await this.getProgram();

    return { mode: this.mode, tokenStatus: 'отримано', organization, program };
  }

  // ---------- гості ----------

  /** Сума балансів гаманців гостя саме за нашою програмою. */
  #extractBalance(customer, walletId) {
    const balances = customer?.walletBalances ?? [];

    const wallet =
      balances.find((item) => (item.id ?? item.walletId) === walletId) ?? null;

    return {
      balance: Number(wallet?.balance ?? 0),
      walletId: wallet ? (wallet.id ?? wallet.walletId) : null,
    };
  }

  async findCustomerByPhone(phone) {
    const organizationId = await this.#getOrganizationId();
    const program = await this.getProgram();

    let payload;
    try {
      payload = await this.#request('/api/1/loyalty/syrve/customer/info', {
        type: 'phone',
        phone,
        organizationId,
      });
    } catch (error) {
      // Гостя немає — це не збій, а нормальний результат пошуку.
      if (error instanceof SyrveNotFoundError) return null;
      throw error;
    }

    const customer = payload?.customer ?? payload;
    if (!customer?.id) return null;

    const { balance, walletId } = this.#extractBalance(
      customer,
      program.walletId,
    );

    return {
      id: customer.id,
      name: customer.name ?? null,
      phone: customer.phone ?? phone,
      cards: (customer.cards ?? []).map((card) => ({
        number: card.number ?? null,
        track: card.track ?? null,
      })),
      balance,
      walletId: walletId ?? program.walletId,
    };
  }

  async createOrUpdateCustomer({ phone, name }) {
    const organizationId = await this.#getOrganizationId();

    const payload = await this.#request(
      '/api/1/loyalty/syrve/customer/create_or_update',
      { phone, name, organizationId },
    );

    const id = payload?.id ?? payload?.customerId ?? null;

    if (!id) throw new SyrveError('Syrve не повернув id гостя');

    return id;
  }

  async addCustomerToProgram(customerId) {
    const organizationId = await this.#getOrganizationId();
    const program = await this.getProgram();

    await this.#request('/api/1/loyalty/syrve/customer/program/add', {
      customerId,
      programId: program.id,
      organizationId,
    });
  }

  async addCard({ customerId, cardNumber, cardTrack }) {
    const organizationId = await this.#getOrganizationId();

    await this.#request('/api/1/loyalty/syrve/customer/card/add', {
      customerId,
      cardNumber,
      cardTrack: cardTrack ?? cardNumber,
      organizationId,
    });
  }

  async topUpWallet({ customerId, walletId, sum, comment }) {
    const organizationId = await this.#getOrganizationId();

    await this.#request('/api/1/loyalty/syrve/customer/wallet/topup', {
      customerId,
      walletId,
      sum,
      comment,
      organizationId,
    });
  }

  async chargeOffWallet({ customerId, walletId, sum, comment }) {
    const organizationId = await this.#getOrganizationId();

    await this.#request('/api/1/loyalty/syrve/customer/wallet/chargeoff', {
      customerId,
      walletId,
      sum,
      comment,
      organizationId,
    });
  }

  async getTransactionsByRevision({ customerId, revision = 0, pageSize = 100 }) {
    const organizationId = await this.#getOrganizationId();

    const payload = await this.#request(
      '/api/1/loyalty/syrve/customer/transactions/by_revision',
      { customerId, revision, pageSize, organizationId },
    );

    const transactions = (payload?.transactions ?? []).map((item) => ({
      id: item.id,
      revision: Number(item.revision),
      type: item.type ?? null,
      typeName: item.typeName ?? null,
      sum: Number(item.sum ?? 0),
      balanceAfter: Number(item.balanceAfter ?? 0),
      comment: item.comment ?? null,
      whenCreated: item.whenCreated ?? null,
    }));

    return {
      transactions,
      lastRevision: Number(payload?.lastRevision ?? revision),
    };
  }
}
