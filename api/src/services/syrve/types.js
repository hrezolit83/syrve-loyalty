/**
 * Контракт клієнта Syrve — один для справжнього й мок-режиму.
 *
 * JS без типів, тому інтерфейс описаний тут як документація + базовий клас:
 * якщо реалізація забуде метод, впаде зрозуміла помилка, а не "undefined is
 * not a function" десь у контролері.
 *
 * Формат даних — нормалізований, не "як у Syrve": далі по коду використовуємо
 * тільки ці форми.
 *
 * @typedef {object} SyrveOrganization
 * @property {string} id
 * @property {string} name
 *
 * @typedef {object} SyrveProgram
 * @property {string} id
 * @property {string} name
 * @property {string} walletId
 * @property {boolean} isActive
 *
 * @typedef {object} SyrveCard
 * @property {string} number
 * @property {string} track
 *
 * @typedef {object} SyrveCustomer
 * @property {string} id
 * @property {string|null} name
 * @property {string|null} phone
 * @property {SyrveCard[]} cards
 * @property {number} balance        сума балансів гаманців програми
 * @property {string|null} walletId  гаманець програми лояльності
 *
 * @typedef {object} SyrveTransaction
 * @property {string} id
 * @property {number} revision
 * @property {string} type
 * @property {string} typeName
 * @property {number} sum
 * @property {number} balanceAfter
 * @property {string|null} comment
 * @property {string} whenCreated
 */

const notImplemented = (method) => {
  throw new Error(`Клієнт Syrve не реалізує метод ${method}()`);
};

export class SyrveClient {
  /** @returns {Promise<'real'|'mock'>} */
  get mode() {
    return notImplemented('mode');
  }

  /**
   * Перевірка зв'язку: токен + організація + програма.
   * Повертає {mode, tokenStatus, organization, program}.
   * Саме значення токена не повертається ніколи.
   */
  async checkConnection() {
    return notImplemented('checkConnection');
  }

  /** @returns {Promise<SyrveOrganization>} */
  async getOrganization() {
    return notImplemented('getOrganization');
  }

  /** @returns {Promise<SyrveProgram>} */
  async getProgram() {
    return notImplemented('getProgram');
  }

  /** @returns {Promise<SyrveCustomer|null>} null — гостя немає */
  async findCustomerByPhone(phone) {
    return notImplemented('findCustomerByPhone');
  }

  /** @returns {Promise<SyrveCustomer|null>} null — гостя немає */
  async findCustomerById(customerId) {
    return notImplemented('findCustomerById');
  }

  /** @returns {Promise<string>} id гостя */
  async createOrUpdateCustomer({ phone, name }) {
    return notImplemented('createOrUpdateCustomer');
  }

  async addCustomerToProgram(customerId) {
    return notImplemented('addCustomerToProgram');
  }

  async addCard({ customerId, cardNumber, cardTrack }) {
    return notImplemented('addCard');
  }

  async topUpWallet({ customerId, walletId, sum, comment }) {
    return notImplemented('topUpWallet');
  }

  async chargeOffWallet({ customerId, walletId, sum, comment }) {
    return notImplemented('chargeOffWallet');
  }

  /** @returns {Promise<{transactions: SyrveTransaction[], lastRevision: number}>} */
  async getTransactionsByRevision({ customerId, revision, pageSize }) {
    return notImplemented('getTransactionsByRevision');
  }
}
