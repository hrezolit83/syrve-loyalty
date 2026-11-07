/**
 * Перевірка надійності сповіщень (О6).
 *
 * Запуск із папки api/:  node scripts/check-notifications.mjs
 * Працює в мок-режимі, щоб не чекати на реальні операції в Syrve.
 *
 * Підміняється ТІЛЬКИ bot.api.sendMessage (щоб не потрібен був живий
 * Telegram) — поллер, outbox, воркер сповіщень, черги BullMQ і БД справжні.
 *
 * Перевіряє: одна операція — одне повідомлення; повторні проходи поллера
 * не дають дублів; перезапуск воркерів не дає дублів; зміна, зроблена в
 * Syrve напряму, доходить до гостя; блокування бота (403) знімає задачу
 * без ретраїв і позначає гостя.
 */
process.env.SYRVE_MODE = 'mock';
process.env.LOG_LEVEL = 'warn';

const { bot } = await import('../src/bot/bot.js');
const { prisma } = await import('../src/db/prisma.js');
const { getSyrveClient } = await import('../src/services/syrve/index.js');
const { registerGuest } = await import('../src/services/guests.js');
const { notifyQueue } = await import('../src/queues/notifyQueue.js');
const { pollQueue } = await import('../src/queues/pollQueue.js');
const { createPollWorker } = await import('../src/workers/pollWorker.js');
const { createNotifyWorker } = await import('../src/workers/notifyWorker.js');
const { JOB_NAMES } = await import('../src/constants/index.js');
const { redisConnection } = await import('../src/queues/connection.js');

// --- підміна відправки в Telegram ---
const sent = [];
let failNextWith = null;

bot.api.sendMessage = async (chatId, text) => {
  if (failNextWith) {
    const error = failNextWith;
    failNextWith = null;
    throw error;
  }
  sent.push({ chatId, text });
  return { message_id: sent.length };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitQueueEmpty = async () => {
  for (let i = 0; i < 60; i += 1) {
    const counts = await notifyQueue.getJobCounts('waiting', 'active', 'delayed');
    const poll = await pollQueue.getJobCounts('waiting', 'active', 'delayed');
    if (
      counts.waiting + counts.active + counts.delayed === 0 &&
      poll.waiting + poll.active + poll.delayed === 0
    ) {
      await sleep(150);
      return;
    }
    await sleep(200);
  }
  throw new Error('Черга не спорожніла');
};

const runPoll = async () => {
  await pollQueue.add(JOB_NAMES.POLL_TRANSACTIONS, {});
  await waitQueueEmpty();
};

// --- підготовка ---
await notifyQueue.obliterate({ force: true });
await pollQueue.obliterate({ force: true });

const phone = '+380671234567';
await prisma.guest.deleteMany({ where: { phone } });
await prisma.mockCustomer.deleteMany({ where: { phone } });

const guest = await registerGuest({
  telegramId: 5001,
  chatId: 5001,
  phone,
  name: 'Тарас',
});
const client = getSyrveClient();
const program = await client.getProgram();

const pollWorker = createPollWorker();
const notifyWorker = createNotifyWorker();

const ok = (label, condition, extra = '') =>
  console.log(`${condition ? 'OK  ' : 'ЗБІЙ'} ${label}${extra ? ' — ' + extra : ''}`);

// --- 1. операція з панелі → рівно одне повідомлення ---
await client.topUpWallet({
  customerId: guest.syrveCustomerId,
  walletId: program.walletId,
  sum: 150,
  comment: 'Вітальний бонус',
});
await runPoll();

ok('операція з панелі дає рівно 1 повідомлення', sent.length === 1, `надіслано ${sent.length}`);
console.log('     текст:', JSON.stringify(sent[0]?.text));

// --- 2. повторний прохід поллера → без дублів ---
await runPoll();
await runPoll();
ok('два додаткові проходи не створюють дублів', sent.length === 1, `надіслано ${sent.length}`);

// --- 3. рестарт воркерів → без дублів ---
await pollWorker.close();
await notifyWorker.close();

const pollWorker2 = createPollWorker();
const notifyWorker2 = createNotifyWorker();
await runPoll();
ok('після рестарту воркерів дублів немає', sent.length === 1, `надіслано ${sent.length}`);

/**
 * Пише транзакцію прямо в mock_transactions — так імітується зміна, зроблена
 * НЕ через наш сервіс (кабінет Syrve Loyalty, каса).
 */
const insertSyrveSideTransaction = async ({ type, typeName, sum, comment, balanceAfter }) => {
  const last = await prisma.mockTransaction.findFirst({
    where: { customerId: guest.syrveCustomerId },
    orderBy: { revision: 'desc' },
  });

  const next =
    balanceAfter === null ? null : Number(last.balanceAfter) + Number(sum);

  await prisma.$transaction([
    prisma.mockTransaction.create({
      data: {
        customerId: guest.syrveCustomerId,
        revision: (last?.revision ?? 0n) + 1n,
        type,
        typeName,
        sum,
        balanceAfter: next,
        comment,
      },
    }),
    ...(next === null
      ? []
      : [
          prisma.mockCustomer.update({
            where: { id: guest.syrveCustomerId },
            data: { balance: next },
          }),
        ]),
  ]);
};

// --- 4. зміна з кабінету Syrve Loyalty: тип 7 RefillWallet ---
// Саме цей тип приходить на «Змінення балансу» в кабінеті — перевірено
// вручну на живій організації.
await insertSyrveSideTransaction({
  type: '7',
  typeName: 'RefillWallet',
  sum: 12.5,
  comment: 'Зміна балансу з кабінету',
});

await runPoll();
ok('зміна з кабінету Syrve (тип 7) дає 1 нове повідомлення', sent.length === 2, `надіслано ${sent.length}`);
ok('   напрямок правильний (нараховано)', sent[1]?.text.includes('Нараховано'), JSON.stringify(sent[1]?.text));

// --- 4б. НЕВІДОМИЙ код типу з ВІД'ЄМНОЮ сумою ---
// Головна перевірка правила «напрямок за знаком суми»: назва типу натякає
// на нарахування, код нам невідомий, але сума від'ємна — гість має побачити
// «Списано», а не «Нараховано».
await insertSyrveSideTransaction({
  type: '99',
  typeName: 'RefillSomethingUnknown',
  sum: -7,
  comment: 'Невідомий тип, мінусова сума',
});

await runPoll();
ok('невідомий тип із sum != 0 дає сповіщення', sent.length === 3, `надіслано ${sent.length}`);
ok('   напрямок за знаком суми, а не за назвою типу', sent[2]?.text.includes('Списано'), JSON.stringify(sent[2]?.text));

// --- 4в. нейтральна транзакція: sum = 0, balanceAfter = null ---
// Так приходить SetGuestCategory. Сповіщення не має бути, але курсор
// мусить зсунутися, інакше поллер читав би її вічно.
const beforeNeutral = await prisma.guest.findUnique({ where: { id: guest.id } });

await insertSyrveSideTransaction({
  type: '21',
  typeName: 'SetGuestCategory',
  sum: 0,
  balanceAfter: null,
  comment: 'Кэшбек 1%',
});

await runPoll();
const afterNeutral = await prisma.guest.findUnique({ where: { id: guest.id } });
ok('SetGuestCategory не породжує сповіщення', sent.length === 3, `надіслано ${sent.length}`);
ok('   але курсор зсунуто', afterNeutral.lastRevision > beforeNeutral.lastRevision,
  `${beforeNeutral.lastRevision} → ${afterNeutral.lastRevision}`);

// --- 5. списання через сервіс → текст про списання ---
await client.chargeOffWallet({
  customerId: guest.syrveCustomerId,
  walletId: program.walletId,
  sum: 40,
  comment: 'Оплата кави',
});
await runPoll();
ok('списання через сервіс дає повідомлення про списання',
  sent.length === 4 && sent[3].text.includes('Списано'), JSON.stringify(sent[3]?.text));

// --- 6. гість заблокував бота: 403 → позначка, без ретраїв ---
failNextWith = Object.assign(new Error('Forbidden: bot was blocked by the user'), {
  error_code: 403,
  description: 'Forbidden: bot was blocked by the user',
});
await client.topUpWallet({
  customerId: guest.syrveCustomerId,
  walletId: program.walletId,
  sum: 10,
  comment: 'Після блокування',
});
await runPoll();

const blocked = await prisma.guest.findUnique({ where: { id: guest.id } });
ok('403 позначає гостя як заблокованого', blocked.botBlockedAt !== null);
ok('403 не породжує повторних відправок', sent.length === 4, `надіслано ${sent.length}`);

const failedJobs = await notifyQueue.getFailed();
const relevant = failedJobs.filter((job) => job.attemptsMade === 1);
ok('задача 403 знята без ретраїв (attemptsMade=1)', relevant.length >= 1, `впало з 1 спроби: ${relevant.length}`);

// --- 7. стан у БД ---
const rows = await prisma.processedTransaction.findMany({
  where: { guestId: guest.id },
  orderBy: { revision: 'asc' },
  select: { revision: true, type: true, sum: true, balanceAfter: true, notifiedAt: true, notifyError: true },
});
console.log('\nprocessed_transactions:');
for (const r of rows) {
  console.log(
    `   rev ${r.revision} ${r.type.padEnd(16)} sum=${String(r.sum).padStart(7)} balance=${String(r.balanceAfter).padStart(7)} ` +
      `notifiedAt=${r.notifiedAt ? 'є' : '—'} ${r.notifyError ?? ''}`,
  );
}
const guestAfter = await prisma.guest.findUnique({ where: { id: guest.id } });
console.log('guest.lastRevision =', guestAfter.lastRevision.toString());
ok('курсор дорівнює останній ревізії', guestAfter.lastRevision === rows[rows.length - 1].revision);
ok('усі доставлені транзакції мають notifiedAt', rows.filter((r) => r.notifiedAt).length === 4);

// --- прибирання ---
// Порядок важливий: спершу воркери (вони тримають блокуючі підключення до
// Redis), потім дані, потім черги й самі підключення.
await pollWorker2.close();
await notifyWorker2.close();

await prisma.processedTransaction.deleteMany({ where: { guestId: guest.id } });
await prisma.guest.deleteMany({ where: { phone } });
await prisma.mockCustomer.deleteMany({ where: { phone } });
await prisma.$disconnect();

await notifyQueue.obliterate({ force: true });
await pollQueue.obliterate({ force: true });
await notifyQueue.close();
await pollQueue.close();
redisConnection.disconnect();

console.log('Перевірку завершено.');

// BullMQ лишає по собі службові таймери й підписки, через які процес може
// не завершитися сам. Для скрипта перевірки це не проблема — виходимо явно.
process.exit(0);
