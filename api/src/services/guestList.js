import { prisma } from '../db/prisma.js';
import { formatPhone, normalizePhone } from '../utils/phone.js';

/**
 * Список гостей, зареєстрованих через бот (Д2).
 *
 * Читається з НАШОЇ БД, а не з Syrve, і це свідомо: у Syrve немає методу
 * «віддай усіх гостей» (лише пошук за телефоном, картою чи id), а в нашій
 * таблиці рівно ті гості, що прийшли через бот — саме їх і просять показати.
 *
 * Баланс у списку не показуємо: він живе в Syrve, і щоб дістати його для
 * сторінки з 20 гостей, довелося б зробити 20 запитів до Syrve на кожне
 * відкриття списку. Баланс видно на картці гостя, де запит один.
 */
export const getGuestList = async ({ search, sort, order, page, pageSize }) => {
  const term = String(search ?? '').trim();

  // Пошук за ім'ям або телефоном. Телефон спершу нормалізуємо: у базі він
  // завжди у форматі +380XXXXXXXXX, а шукати будуть як завгодно
  // («067…», «+380 67…»). Якщо нормалізація не вдалася — шукаємо як підрядок,
  // щоб працювало введення неповного номера.
  const normalizedPhone = normalizePhone(term);
  const digits = term.replace(/\D/g, '');

  // Умови по телефону й картці додаємо ЛИШЕ коли в запиті є цифри.
  // Інакше для пошуку «ар» вийшло б `contains: ''`, яке матчить усе —
  // і список віддавав би всіх гостей замість знайдених.
  const conditions = [{ name: { contains: term, mode: 'insensitive' } }];

  if (digits) {
    conditions.push({ phone: { contains: normalizedPhone ?? digits } });
    conditions.push({ cardNumber: { contains: digits } });
  }

  const where = term ? { OR: conditions } : {};

  // sort і order прийшли з білого списку Joi, тому їх можна підставляти.
  const orderBy =
    sort === 'name'
      ? // Гості без імені (незавершена реєстрація) — у кінець списку.
        [{ name: { sort: order, nulls: 'last' } }]
      : [{ createdAt: order }];

  const [total, guests] = await prisma.$transaction([
    prisma.guest.count({ where }),
    prisma.guest.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        phone: true,
        cardNumber: true,
        syrveCustomerId: true,
        botBlockedAt: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    guests: guests.map((guest) => ({
      id: guest.id,
      customerId: guest.syrveCustomerId,
      name: guest.name,
      phone: guest.phone,
      phoneFormatted: formatPhone(guest.phone),
      cardNumber: guest.cardNumber,
      botBlocked: guest.botBlockedAt !== null,
      createdAt: guest.createdAt,
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
};
