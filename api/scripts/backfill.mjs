/**
 * Разовий бекфіл історії для гостей, прив'язаних до появи цієї логіки.
 *
 * Їхня базова лінія `lastRevision` була виставлена на кінець історії, тому
 * в нашій базі немає жодної транзакції, що сталася до підключення бота —
 * статистика й журнал транзакцій показують для них порожньо.
 *
 * Скрипт безпечно запускати повторно: вставка йде з ON CONFLICT DO NOTHING,
 * а рядки, про які сповіщення вже надіслано, не переписуються. Сповіщень
 * бекфіл не породжує: кожен запис одразу з notifiedAt.
 *
 *   npm run backfill            # усі гості
 *   npm run backfill -- <phone> # один гість за телефоном
 */
import { prisma } from '../src/db/prisma.js';
import { backfillGuestHistory } from '../src/services/backfill.js';
import { getSyrveClient } from '../src/services/syrve/index.js';
import { logger } from '../src/utils/logger.js';
import { normalizePhone } from '../src/utils/phone.js';

const phoneArg = process.argv[2] ? normalizePhone(process.argv[2]) : null;

if (process.argv[2] && !phoneArg) {
  console.error(`Не розпізнав телефон: ${process.argv[2]}`);
  process.exit(1);
}

const guests = await prisma.guest.findMany({
  where: {
    syrveCustomerId: { not: null },
    ...(phoneArg ? { phone: phoneArg } : {}),
  },
  select: {
    id: true,
    name: true,
    phone: true,
    syrveCustomerId: true,
    whenRegistered: true,
  },
});

if (guests.length === 0) {
  console.log('Гостей для бекфілу немає.');
  await prisma.$disconnect();
  process.exit(0);
}

console.log(`Гостей до обробки: ${guests.length}\n`);

const client = getSyrveClient();

let totalInserted = 0;
let failed = 0;

for (const guest of guests) {
  const label = `${guest.name ?? 'без імені'} (${guest.phone ?? '—'})`;

  try {
    // Заразом заповнюємо дату реєстрації в Syrve, якщо її ще немає:
    // статистика рахує «нові реєстрації» саме за нею.
    if (!guest.whenRegistered) {
      const customer = await client.findCustomerById(guest.syrveCustomerId);

      if (customer?.whenRegistered) {
        await prisma.guest.update({
          where: { id: guest.id },
          data: { whenRegistered: new Date(customer.whenRegistered) },
        });
        console.log(`  ${label}: whenRegistered = ${customer.whenRegistered}`);
      }
    }

    const { inserted, lastRevision } = await backfillGuestHistory(guest);

    totalInserted += inserted;
    console.log(
      `  ${label}: записано ${inserted}, курсор ${lastRevision}`,
    );
  } catch (error) {
    failed += 1;
    logger.error({ err: error, guestId: guest.id }, 'Бекфіл не вдався');
    console.error(`  ${label}: ПОМИЛКА — ${error.message}`);
  }
}

console.log(
  `\nГотово. Додано транзакцій: ${totalInserted}. Помилок: ${failed}.`,
);

await prisma.$disconnect();
process.exit(failed > 0 ? 1 : 0);
