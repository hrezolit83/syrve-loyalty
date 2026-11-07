import { prisma } from '../../db/prisma.js';
import { logger } from '../../utils/logger.js';
import {
  SyrveNotFoundError,
  SyrveValidationError,
} from './errors.js';
import { SyrveClient } from './types.js';

/**
 * Мок-клієнт Syrve: той самий інтерфейс, що й у RealSyrveClient, але дані
 * лежать у таблицях mock_customers / mock_transactions.
 *
 * Для чого: ТЗ вимагає, щоб сервіс можна було запустити й показати без
 * доступу до Syrve. Форма даних і поведінка повторюють справжнє API,
 * включно з revision-курсором — тому поллер сповіщень (О6) у мок-режимі
 * працює так само, як у real.
 *
 * Чому БД, а не пам'ять: api і worker — різні процеси, спільна пам'ять
 * між ними неможлива.
 */

/** Фіксовані id, щоб мок виглядав стабільно між перезапусками. */
const MOCK_ORGANIZATION = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Тестовий заклад (мок-режим)',
};

const MOCK_PROGRAM = {
  id: '22222222-2222-2222-2222-222222222222',
  name: 'Кешбек 5% (мок-режим)',
  walletId: '33333333-3333-3333-3333-333333333333',
  isActive: true,
};

/**
 * Типи транзакцій — рівно ті, що віддає живий Syrve на нарахування і
 * списання через API (перевірено, docs/api-samples/11-...json):
 * числовий код у `type`, назва в `typeName`.
 */
const TRANSACTION_TYPES = {
  topup: { type: '35', typeName: 'RefillWalletFromApi' },
  chargeoff: { type: '40', typeName: 'WithdrawWalletFromApi' },
};

/**
 * Ревізії в Syrve — великі 64-бітні числа (бачили 5 203 511 329).
 * Мок стартує з такого ж порядку, щоб помилка з Int замість BigInt
 * вилізла вже в мок-режимі, а не на живих даних.
 */
const REVISION_BASE = 5_200_000_000n;

const toNumber = (value) => Number(value ?? 0);

export class MockSyrveClient extends SyrveClient {
  get mode() {
    return 'mock';
  }

  async checkConnection() {
    // Токен у мок-режимі не потрібен, але БД — так: без неї мок не працює.
    await prisma.$queryRaw`SELECT 1`;

    return {
      mode: this.mode,
      tokenStatus: 'не потрібен (мок-режим)',
      organization: MOCK_ORGANIZATION,
      program: MOCK_PROGRAM,
    };
  }

  async getOrganization() {
    return MOCK_ORGANIZATION;
  }

  async getProgram() {
    return MOCK_PROGRAM;
  }

  #toCustomer(row) {
    const cards = row.cardNumber
      ? [{ number: row.cardNumber, track: row.cardTrack ?? row.cardNumber }]
      : [];

    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      cards,
      balance: toNumber(row.balance),
      walletId: MOCK_PROGRAM.walletId,
    };
  }

  async findCustomerByPhone(phone) {
    const row = await prisma.mockCustomer.findUnique({ where: { phone } });

    return row ? this.#toCustomer(row) : null;
  }

  async findCustomerById(customerId) {
    const row = await prisma.mockCustomer.findUnique({
      where: { id: customerId },
    });

    return row ? this.#toCustomer(row) : null;
  }

  async createOrUpdateCustomer({ phone, name }) {
    const row = await prisma.mockCustomer.upsert({
      where: { phone },
      update: { name },
      create: { phone, name },
    });

    return row.id;
  }

  async addCustomerToProgram(customerId) {
    await prisma.mockCustomer.update({
      where: { id: customerId },
      data: { inProgram: true },
    });
  }

  async addCard({ customerId, cardNumber, cardTrack }) {
    await prisma.mockCustomer.update({
      where: { id: customerId },
      data: { cardNumber, cardTrack: cardTrack ?? cardNumber },
    });
  }

  /**
   * Зміна балансу + транзакція одним кроком.
   *
   * Все в одній транзакції БД: інакше між читанням балансу й записом
   * могла б втиснутись інша операція, і balanceAfter збрехав би.
   * revision = max+1 у межах гостя, як монотонний курсор у Syrve.
   */
  async #applyWalletChange({ customerId, sum, comment, kind }) {
    const amount = Number(sum);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new SyrveValidationError('Сума має бути більшою за нуль');
    }

    return prisma.$transaction(async (tx) => {
      const customer = await tx.mockCustomer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new SyrveNotFoundError('Гостя не знайдено в мок-Syrve');
      }

      const balanceBefore = toNumber(customer.balance);
      const delta = kind === 'topup' ? amount : -amount;
      const balanceAfter = balanceBefore + delta;

      // УВАГА: справжній Syrve списання понад баланс НЕ відхиляє — перевірено
      // на живому API, баланс спокійно пішов у -999993
      // (docs/api-samples/10-chargeoff-over-balance.json).
      // Мок поводиться так само, інакше він створював би ілюзію захисту,
      // якого в Syrve немає. Єдиний захист — перевірка балансу перед
      // списанням у services/operations.js.
      if (balanceAfter < 0) {
        logger.warn(
          { customerId, balanceBefore, amount },
          'Мок-Syrve: баланс пішов у мінус (як і справжній Syrve)',
        );
      }

      const last = await tx.mockTransaction.findFirst({
        where: { customerId },
        orderBy: { revision: 'desc' },
        select: { revision: true },
      });

      // Крок 10, як у Syrve (ревізії там не йдуть щільно: 259, 299, 309).
      const revision = (last?.revision ?? REVISION_BASE) + 10n;
      const { type, typeName } = TRANSACTION_TYPES[kind];

      await tx.mockCustomer.update({
        where: { id: customerId },
        data: { balance: balanceAfter },
      });

      await tx.mockTransaction.create({
        data: {
          customerId,
          revision,
          type,
          typeName,
          // sum у Syrve зі знаком: нарахування +, списання −.
          sum: delta,
          balanceAfter,
          comment: comment ?? null,
        },
      });

      logger.debug(
        { customerId, kind, amount, balanceAfter },
        'Мок-Syrve: баланс змінено',
      );

      return { balanceAfter, revision: Number(revision) };
    });
  }

  async topUpWallet({ customerId, sum, comment }) {
    return this.#applyWalletChange({ customerId, sum, comment, kind: 'topup' });
  }

  async chargeOffWallet({ customerId, sum, comment }) {
    return this.#applyWalletChange({
      customerId,
      sum,
      comment,
      kind: 'chargeoff',
    });
  }

  async getTransactionsByRevision({ customerId, revision = 0, pageSize = 100 }) {
    const rows = await prisma.mockTransaction.findMany({
      where: { customerId, revision: { gt: BigInt(revision) } },
      orderBy: { revision: 'asc' },
      take: Number(pageSize),
    });

    const transactions = rows.map((row) => ({
      id: row.id,
      revision: Number(row.revision),
      type: row.type,
      typeName: row.typeName,
      sum: toNumber(row.sum),
      balanceAfter: toNumber(row.balanceAfter),
      comment: row.comment,
      whenCreated: row.whenCreated.toISOString(),
      // Як у Syrve: транзакція належить гаманцю конкретної програми.
      walletId: MOCK_PROGRAM.walletId,
    }));

    const lastRevision =
      transactions.length > 0
        ? transactions[transactions.length - 1].revision
        : Number(revision);

    return { transactions, lastRevision };
  }
}
