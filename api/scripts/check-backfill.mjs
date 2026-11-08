/**
 * Перевірка бекфілу історії: дані на місці, сповіщень про старе немає.
 *
 * Працює по живій базі й живому Syrve, але нічого не змінює в Syrve:
 * повторна реєстрація ідемпотентна, балансів не чіпає.
 */
import { prisma } from '../src/db/prisma.js';
import { registerGuest } from '../src/services/guests.js';

let failed = 0;

const ok = (label, condition, extra = '') => {
  console.log(`${condition ? '  OK  ' : '  ХИБА'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!condition) failed += 1;
};

const snapshot = async () => {
  const [total, historical, pending, guest] = await Promise.all([
    prisma.processedTransaction.count(),
    prisma.processedTransaction.count({ where: { historical: true } }),
    prisma.processedTransaction.count({ where: { notifiedAt: null } }),
    prisma.guest.findFirst({
      select: {
        id: true,
        telegramId: true,
        chatId: true,
        phone: true,
        name: true,
        whenRegistered: true,
        createdAt: true,
        lastRevision: true,
      },
    }),
  ]);

  return { total, historical, pending, guest };
};

const before = await snapshot();

if (!before.guest) {
  console.error('У базі немає жодного гостя — нема що перевіряти.');
  await prisma.$disconnect();
  process.exit(1);
}

console.log('Стан до перевірки:');
console.log(`  транзакцій: ${before.total}, з них історичних: ${before.historical}`);
console.log(`  без сповіщення (notifiedAt IS NULL): ${before.pending}`);
console.log(`  whenRegistered: ${before.guest.whenRegistered?.toISOString() ?? '—'}`);
console.log(`  createdAt:      ${before.guest.createdAt.toISOString()}`);
console.log(`  lastRevision:   ${before.guest.lastRevision}\n`);

ok('історія бекфілена', before.historical > 0, `${before.historical} рядків`);
ok('усі транзакції мають час операції',
  (await prisma.processedTransaction.count({ where: { whenCreated: null } })) === 0);
ok('нічого не чекає на сповіщення', before.pending === 0);
ok('дата реєстрації в Syrve збережена', before.guest.whenRegistered !== null);

// ---- повторна реєстрація (той самий /start) ----
console.log('\nПовторна реєстрація того самого гостя…');

await registerGuest({
  telegramId: before.guest.telegramId,
  chatId: before.guest.chatId,
  phone: before.guest.phone,
  name: before.guest.name,
});

const after = await snapshot();

ok('нових транзакцій не з\'явилося', after.total === before.total,
  `${before.total} → ${after.total}`);
ok('жодна не чекає на сповіщення', after.pending === 0,
  `${after.pending}`);
ok('курсор не відкотився', after.guest.lastRevision === before.guest.lastRevision,
  `${before.guest.lastRevision} → ${after.guest.lastRevision}`);

console.log(failed === 0 ? '\nУсе зелене.' : `\nПровалено перевірок: ${failed}`);

await prisma.$disconnect();
process.exit(failed > 0 ? 1 : 0);
