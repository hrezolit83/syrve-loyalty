/**
 * Перевірка роботи з ЖИВИМ Syrve Cloud API (SYRVE_MODE=real).
 *
 * Запуск із папки api/:  node scripts/check-syrve-real.mjs
 *
 * Що перевіряє: пошук невідомого гостя повертає null; реєстрація створює
 * гостя, картку й базову лінію revision; повторна реєстрація не дає дубля;
 * нарахування і списання змінюють баланс; списання понад баланс відхиляє
 * НАША перевірка (Syrve його дозволяє); синхронізація транзакцій записує
 * лише операції нашої програми й правильно визначає їх тип.
 *
 * УВАГА: створює тестового гостя (+380991000002) у тестовій організації —
 * ТЗ це дозволяє (розділ 2). Баланс після перевірки повертає до нуля,
 * свої записи з БД прибирає.
 */
process.env.LOG_LEVEL = 'warn';

const { getSyrveClient, SyrveNotFoundError } = await import('../src/services/syrve/index.js');
const { registerGuest, getGuestCard } = await import('../src/services/guests.js');
const { applyOperation } = await import('../src/services/operations.js');
const { syncGuestTransactions } = await import('../src/services/transactionSync.js');
const { classifyTransaction } = await import('../src/constants/transactionTypes.js');
const { prisma } = await import('../src/db/prisma.js');
const { redisConnection } = await import('../src/queues/connection.js');

const ok = (label, cond, extra = '') =>
  console.log(`${cond ? 'OK  ' : 'ЗБІЙ'} ${label}${extra ? ' — ' + extra : ''}`);

const client = getSyrveClient();
console.log('режим:', client.mode);

// 1) невідомий телефон → null, а не виняток (це був критичний баг)
let notFoundResult = 'кинуло виняток';
try {
  notFoundResult = await client.findCustomerByPhone('+380999999997');
} catch (error) {
  notFoundResult = `ВИНЯТОК ${error.name}: ${error.message}`;
}
ok('невідомий телефон повертає null', notFoundResult === null, JSON.stringify(notFoundResult));

// 2) повна реєстрація по живому Syrve
const phone = '+380991000002';
await prisma.guest.deleteMany({ where: { phone } });

const guest = await registerGuest({ telegramId: 9001, chatId: 9001, phone, name: 'Перевірка Етапу3' });
console.log('\nзареєстровано:');
console.log('  syrveCustomerId =', guest.syrveCustomerId);
console.log('  cardNumber      =', guest.cardNumber, `(${String(guest.cardNumber).length} цифр)`);
console.log('  lastRevision    =', guest.lastRevision.toString());
ok('картка 10 цифр', /^\d{10}$/.test(guest.cardNumber ?? ''));
ok('базова лінія lastRevision велика (BigInt)', guest.lastRevision > 2147483647n, guest.lastRevision.toString());

// 3) повторна реєстрація не створює дубля в Syrve
const guest2 = await registerGuest({ telegramId: 9002, chatId: 9002, phone, name: 'Перевірка Етапу3' });
ok('повторна реєстрація: той самий гість у Syrve', guest.syrveCustomerId === guest2.syrveCustomerId);
ok('повторна реєстрація: та сама картка', guest.cardNumber === guest2.cardNumber);

// 4) картка й баланс
const card = await getGuestCard(guest2);
console.log('\nкартка гостя:', JSON.stringify(card));
ok('баланс прочитано з гаманця нашої програми', typeof card.balance === 'number');

// 5) нарахування через сервіс панелі
const admin = await prisma.admin.findFirst();
const topup = await applyOperation({
  type: 'topup', adminId: admin.id, syrveCustomerId: guest2.syrveCustomerId,
  amount: 50, reason: 'Перевірка живого Syrve',
});
console.log('\nнарахування:', JSON.stringify(topup));
ok('нарахування змінило баланс', topup.balance === topup.balanceBefore + 50, `${topup.balanceBefore} → ${topup.balance}`);

// 6) списання понад баланс: Syrve дозволив би, наш сервіс — ні
let guard = 'пропустило';
try {
  await applyOperation({
    type: 'chargeoff', adminId: admin.id, syrveCustomerId: guest2.syrveCustomerId,
    amount: 999999, reason: 'Перевірка захисту',
  });
} catch (error) {
  guard = `${error.status}: ${error.message}`;
}
ok('списання понад баланс відхилено НАШОЮ перевіркою', guard.startsWith('409'), guard);

// 7) списання в межах балансу
const charge = await applyOperation({
  type: 'chargeoff', adminId: admin.id, syrveCustomerId: guest2.syrveCustomerId,
  amount: 20, reason: 'Перевірка списання',
});
ok('списання змінило баланс', charge.balance === charge.balanceBefore - 20, `${charge.balanceBefore} → ${charge.balance}`);

// 8) синхронізація транзакцій: фільтр по гаманцю + класифікація типів
const fresh = await prisma.guest.findUnique({ where: { id: guest2.id } });
const inserted = await syncGuestTransactions(fresh);
console.log('\nсинхронізовано транзакцій:', inserted);

const rows = await prisma.processedTransaction.findMany({
  where: { guestId: guest2.id }, orderBy: { revision: 'asc' },
});
for (const r of rows) {
  const kind = classifyTransaction({ type: r.type, typeName: r.typeName, sum: Number(r.sum) });
  console.log(`  rev=${r.revision} type=${r.type} ${r.typeName} sum=${r.sum} balanceAfter=${r.balanceAfter} → ${kind}`);
}
ok('записано рівно 2 транзакції (нарахування + списання)', rows.length === 2, `записано ${rows.length}`);
ok('типи класифіковано правильно',
  rows.length === 2 &&
  classifyTransaction({ type: rows[0].type, typeName: rows[0].typeName, sum: Number(rows[0].sum) }) === 'topup' &&
  classifyTransaction({ type: rows[1].type, typeName: rows[1].typeName, sum: Number(rows[1].sum) }) === 'chargeoff');
ok('SetGuestCategory відфільтровано', !rows.some((r) => r.typeName === 'SetGuestCategory'));

const after = await prisma.guest.findUnique({ where: { id: guest2.id } });
ok('курсор зсунуто', after.lastRevision > fresh.lastRevision, `${fresh.lastRevision} → ${after.lastRevision}`);

// 9) повторна синхронізація не дає нових записів
const again = await syncGuestTransactions(await prisma.guest.findUnique({ where: { id: guest2.id } }));
ok('повторна синхронізація: 0 нових', again === 0, `нових ${again}`);

// 10) повертаємо баланс тестового гостя до нуля
const final = await client.findCustomerById(guest2.syrveCustomerId);
if (final.balance > 0) {
  await client.chargeOffWallet({
    customerId: guest2.syrveCustomerId, walletId: final.walletId,
    sum: final.balance, comment: 'Повернення балансу після перевірки',
  });
  console.log('\nбаланс тестового гостя повернуто до нуля (було', final.balance + ')');
}

await prisma.processedTransaction.deleteMany({ where: { guestId: guest2.id } });
await prisma.operation.deleteMany({ where: { syrveCustomerId: guest2.syrveCustomerId } });
await prisma.guest.deleteMany({ where: { phone } });
await prisma.$disconnect();
redisConnection.disconnect();
