import { prisma } from '../db/prisma.js';
import { getSyrveClient } from './syrve/index.js';
import {
  fetchTransactionsFrom,
  keepProgramTransactions,
  toProcessedRow,
} from './transactionFeed.js';
import { logger } from '../utils/logger.js';

/**
 * Бекфіл історії гостя.
 *
 * Навіщо. Раніше під час прив'язки гостя сервіс просто дочитував
 * `by_revision` до кінця й зберігав останню ревізію як базову лінію, щоб не
 * засипати людину сповіщеннями про старі операції. Побічний ефект помітили
 * пізніше: разом зі сповіщеннями відкидалася й сама історія — у нашій базі
 * не лишалося жодного запису про те, що було до підключення бота, тому
 * статистика (Д9) і журнал транзакцій показували порожньо там, де в Syrve
 * операції були.
 *
 * Тепер замість «пропустити все до цієї ревізії» ми «прочитати все до цієї
 * ревізії й записати як історію»: рядки лягають у ProcessedTransaction з
 * `historical = true` і вже проставленим `notifiedAt`. Перше потрібне, щоб
 * було видно походження запису, друге — щоб outbox їх не підхопив:
 * він шукає саме `notifiedAt IS NULL`.
 *
 * Ідемпотентність тримається на unique по transactionId і
 * `skipDuplicates` (ON CONFLICT DO NOTHING): повторний /start, повторний
 * запуск скрипта чи рестарт воркера нічого не дублюють і нічого не
 * переписують — уже відправлене сповіщення лишається відправленим.
 *
 * Гонки немає: записуємо рівно те, що прочитали, і курсор ставимо на
 * максимум прочитаного. Транзакція, що з'явилася під час бекфілу, отримає
 * більшу ревізію, у нашу вибірку не потрапить — і поллер обробить її
 * звичайним шляхом, зі сповіщенням.
 */
const repairMissingFields = async (tx, guestId, transactions) => {
  const incomplete = await tx.processedTransaction.findMany({
    where: { guestId, OR: [{ whenCreated: null }, { comment: null }] },
    select: { transactionId: true, whenCreated: true, comment: true },
  });

  if (incomplete.length === 0) return;

  const bySyrveId = new Map(
    transactions.map((item) => [String(item.id), item]),
  );

  for (const row of incomplete) {
    const item = bySyrveId.get(row.transactionId);

    if (!item) continue;

    // Заповнюємо лише порожнє: те, що вже записано, не чіпаємо.
    const data = {};

    if (!row.whenCreated && item.whenCreated) {
      data.whenCreated = new Date(item.whenCreated);
    }

    if (row.comment === null && item.comment) data.comment = item.comment;

    if (Object.keys(data).length === 0) continue;

    await tx.processedTransaction.update({
      where: { transactionId: row.transactionId },
      data,
    });
  }
};

export const backfillGuestHistory = async (guest) => {
  if (!guest.syrveCustomerId) return { inserted: 0, lastRevision: 0 };

  const program = await getSyrveClient().getProgram();

  const { transactions, lastRevision } = await fetchTransactionsFrom(
    guest.syrveCustomerId,
    0,
  );

  const relevant = keepProgramTransactions(transactions, program.walletId);

  const now = new Date();

  const inserted = await prisma.$transaction(async (tx) => {
    const result =
      relevant.length > 0
        ? await tx.processedTransaction.createMany({
            data: relevant.map((item) =>
              toProcessedRow(item, guest.id, {
                historical: true,
                notifiedAt: now,
              }),
            ),
            skipDuplicates: true,
          })
        : { count: 0 };

    // Добиваємо рядки без часу операції й коментаря. Такі лишилися від
    // версій, де цих колонок ще не було: вставку ми пропускаємо
    // (ON CONFLICT DO NOTHING), тож самі собою вони не заповняться, і в
    // журналі в них стояв би час поллера замість часу операції.
    // notifiedAt і historical не чіпаємо — вже надіслане лишається надісланим.
    await repairMissingFields(tx, guest.id, relevant);

    // Курсор зсуваємо завжди — і коли все відфільтрували: інакше наступний
    // прохід поллера читав би ті самі непотрібні транзакції вічно.
    await tx.guest.update({
      where: { id: guest.id },
      data: { lastRevision: BigInt(lastRevision) },
    });

    return result.count;
  });

  logger.info(
    {
      guestId: guest.id,
      прочитано: transactions.length,
      доРечі: relevant.length,
      записано: inserted,
      lastRevision,
    },
    'Бекфіл історії гостя',
  );

  return { inserted, lastRevision };
};
