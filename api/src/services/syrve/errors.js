/**
 * Нормалізовані помилки Syrve.
 *
 * Сенс: решта коду не має розбирати HTTP-статуси й тексти Syrve.
 * Вона ловить тип помилки й вирішує, що показати користувачеві.
 * У повідомленнях — тільки українська: їх видно адміністратору й гостю.
 */

export class SyrveError extends Error {
  constructor(message, { status = null, correlationId = null, cause } = {}) {
    super(message, { cause });
    this.name = 'SyrveError';
    this.status = status;
    this.correlationId = correlationId;
  }
}

/** Ключ не підійшов: apiLogin неправильний, не активний або з іншого регіону. */
export class SyrveAuthError extends SyrveError {
  constructor(message = 'Syrve відмовив в авторизації', options) {
    super(message, options);
    this.name = 'SyrveAuthError';
  }
}

/** Syrve не знайшов об'єкт — найчастіше гостя за телефоном. */
export class SyrveNotFoundError extends SyrveError {
  constructor(message = 'Syrve не знайшов запис', options) {
    super(message, options);
    this.name = 'SyrveNotFoundError';
  }
}

/** Syrve відхилив дані запиту (наприклад, списання більше за баланс). */
export class SyrveValidationError extends SyrveError {
  constructor(message = 'Syrve відхилив запит', options) {
    super(message, options);
    this.name = 'SyrveValidationError';
  }
}

/** Мережа, таймаут або 5xx — Syrve тимчасово недоступний. */
export class SyrveUnavailableError extends SyrveError {
  constructor(message = 'Syrve тимчасово недоступний', options) {
    super(message, options);
    this.name = 'SyrveUnavailableError';
  }
}
