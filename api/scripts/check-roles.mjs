/**
 * Перевірка ролей і журналу дій (Д10).
 *
 * Ходить у живий HTTP API так само, як панель: cookie, статуси, тексти.
 * Нічого в Syrve не змінює — операції, які тут робляться, навмисно
 * перевищують ліміт або списують із порожнього балансу, тобто
 * відхиляються ще до запиту в Syrve.
 *
 *   node scripts/check-roles.mjs [http://localhost:3000]
 *
 * Тестового менеджера скрипт створює сам і повністю прибирає за собою:
 * разом із ним зникають його операції та записи журналу дій. Інакше в
 * журналі реального гостя назавжди осідали б рядки «Перевірка ліміту
 * менеджера» від давно неіснуючих check-manager-*.
 *
 * Видалення йде через Prisma напряму, а не через API: методів на
 * видалення журналу в API немає й не буде — у цьому його сенс.
 */
import { prisma } from '../src/db/prisma.js';
import { getEnvVar } from '../src/utils/getEnvVar.js';

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const API = `${BASE}/api`;

const OWNER_LOGIN = getEnvVar('ADMIN_LOGIN');
const OWNER_PASSWORD = getEnvVar('ADMIN_PASSWORD');
const LIMIT = Number(getEnvVar('ADMIN_MANAGER_LIMIT', '500'));

/** Префікс тестових логінів: за ним же й прибираємо. */
const TEST_LOGIN_PREFIX = 'check-manager-';

const MANAGER_LOGIN = `${TEST_LOGIN_PREFIX}${Date.now()}`;
const MANAGER_PASSWORD = 'manager-check-123';

let failed = 0;

/**
 * Прибирає тестових менеджерів і всі їхні сліди.
 *
 * Запускається двічі: на старті (раптом попередній запуск упав на
 * півдорозі) і в кінці. Порядок важливий — Operation.admin оголошено з
 * onDelete: Restrict, тож спершу сліди, потім самі адміністратори.
 *
 * З журналу дій прибираємо три різновиди записів: дії самого тестового
 * менеджера, невдалі входи під його логіном (там adminId порожній) і дії
 * власника НАД ним — створення та деактивацію.
 */
const cleanupTestAdmins = async () => {
  const admins = await prisma.admin.findMany({
    where: { login: { startsWith: TEST_LOGIN_PREFIX } },
    select: { id: true },
  });

  if (admins.length === 0) return null;

  const ids = admins.map((item) => item.id);

  const operations = await prisma.operation.deleteMany({
    where: { adminId: { in: ids } },
  });

  const audit = await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { adminId: { in: ids } },
        { adminLogin: { startsWith: TEST_LOGIN_PREFIX } },
        { targetId: { in: ids } },
      ],
    },
  });

  await prisma.admin.deleteMany({ where: { id: { in: ids } } });

  return { admins: ids.length, operations: operations.count, audit: audit.count };
};

const ok = (label, condition, extra = '') => {
  console.log(
    `${condition ? '  OK  ' : '  ХИБА'} ${label}${extra ? ` — ${extra}` : ''}`,
  );
  if (!condition) failed += 1;
};

/** Мінімальний клієнт із власною cookie-банкою: сесії не мають змішуватись. */
const createSession = () => {
  let cookie = '';

  return async (method, path, body) => {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];

    const text = await response.text();
    let payload = null;

    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text.slice(0, 120) };
    }

    return { status: response.status, body: payload };
  };
};

const owner = createSession();
const manager = createSession();

console.log(`API: ${API}\nЛіміт менеджера: ${LIMIT}\n`);

const leftovers = await cleanupTestAdmins();

if (leftovers) {
  console.log(
    `  прибрано залишки минулого запуску: адміністраторів ${leftovers.admins}, ` +
      `операцій ${leftovers.operations}, записів журналу ${leftovers.audit}\n`,
  );
}

// ---------- власник ----------
const ownerLogin = await owner('POST', '/auth/login', {
  login: OWNER_LOGIN,
  password: OWNER_PASSWORD,
});

ok('власник входить', ownerLogin.status === 200, `HTTP ${ownerLogin.status}`);
ok(
  'роль власника — owner',
  ownerLogin.body?.data?.admin?.role === 'owner',
  String(ownerLogin.body?.data?.admin?.role),
);

if (ownerLogin.status !== 200) {
  console.error('\nБез входу власника далі нема сенсу.');
  process.exit(1);
}

const ownerId = ownerLogin.body.data.admin.id;

// ---------- створення менеджера ----------
const created = await owner('POST', '/admin/admins', {
  login: MANAGER_LOGIN,
  password: MANAGER_PASSWORD,
  role: 'manager',
});

ok('власник створює менеджера', created.status === 201, `HTTP ${created.status}`);

const managerId = created.body?.data?.admin?.id;

if (!managerId) {
  console.error('\nМенеджера не створено — далі нема сенсу.');
  process.exit(1);
}

// ---------- власник не може зачинити себе ----------
const selfOff = await owner('PATCH', `/admin/admins/${ownerId}`, { isActive: false });
ok(
  'власник не може деактивувати себе',
  selfOff.status === 409,
  `HTTP ${selfOff.status}: ${selfOff.body?.message}`,
);

const selfDemote = await owner('PATCH', `/admin/admins/${ownerId}`, {
  role: 'manager',
});
ok(
  'власник не може забрати собі роль owner',
  selfDemote.status === 409,
  `HTTP ${selfDemote.status}: ${selfDemote.body?.message}`,
);

// ---------- менеджер ----------
const managerLogin = await manager('POST', '/auth/login', {
  login: MANAGER_LOGIN,
  password: MANAGER_PASSWORD,
});

ok('менеджер входить', managerLogin.status === 200, `HTTP ${managerLogin.status}`);
ok(
  'роль менеджера — manager',
  managerLogin.body?.data?.admin?.role === 'manager',
  String(managerLogin.body?.data?.admin?.role),
);

// ---------- що менеджеру доступно ----------
for (const [label, path] of [
  ['головна (статистика)', '/admin/stats?period=7d'],
  ['клієнти', '/admin/guests?page=1'],
  ['транзакції', '/admin/transactions?period=all'],
]) {
  const res = await manager('GET', path);
  ok(`менеджер має доступ: ${label}`, res.status === 200, `HTTP ${res.status}`);
}

// ---------- що менеджеру заборонено ----------
for (const [label, method, path, body] of [
  ['список адміністраторів', 'GET', '/admin/admins', undefined],
  ['створення адміністратора', 'POST', '/admin/admins', {
    login: 'hacker-login',
    password: 'hacker-password',
  }],
  ['зміна адміністратора', 'PATCH', `/admin/admins/${managerId}`, {
    role: 'owner',
  }],
  ['журнал дій', 'GET', '/admin/audit?period=7d', undefined],
]) {
  const res = await manager(method, path, body);
  ok(
    `менеджеру 403: ${label}`,
    res.status === 403,
    `HTTP ${res.status}: ${res.body?.message}`,
  );
}

// ---------- ліміт суми ----------
const guests = await owner('GET', '/admin/guests?page=1&pageSize=1');
const customerId = guests.body?.data?.guests?.[0]?.customerId;

if (customerId) {
  const overLimit = await manager(
    'POST',
    `/admin/guests/${customerId}/topup`,
    { amount: LIMIT + 1, reason: 'Перевірка ліміту менеджера' },
  );

  ok(
    'менеджер не може нарахувати понад ліміт',
    overLimit.status === 403,
    `HTTP ${overLimit.status}: ${overLimit.body?.message}`,
  );
  ok(
    'текст відмови українською й із сумою',
    /ліміт/i.test(overLimit.body?.message ?? '') &&
      String(overLimit.body?.message ?? '').includes(String(LIMIT)),
    overLimit.body?.message,
  );

  const overLimitOff = await manager(
    'POST',
    `/admin/guests/${customerId}/chargeoff`,
    { amount: LIMIT + 1, reason: 'Перевірка ліміту менеджера' },
  );

  ok(
    'менеджер не може списати понад ліміт',
    overLimitOff.status === 403,
    `HTTP ${overLimitOff.status}`,
  );
} else {
  console.log('  ПРОПУЩЕНО перевірку ліміту: у базі немає жодного гостя');
}

// ---------- деактивація обриває живу сесію ----------
const deactivate = await owner('PATCH', `/admin/admins/${managerId}`, {
  isActive: false,
});
ok('власник деактивує менеджера', deactivate.status === 200, `HTTP ${deactivate.status}`);

const afterOff = await manager('GET', '/admin/stats?period=7d');
ok(
  'жива сесія деактивованого перестає працювати',
  afterOff.status === 403,
  `HTTP ${afterOff.status}: ${afterOff.body?.message}`,
);

const loginOff = await createSession()('POST', '/auth/login', {
  login: MANAGER_LOGIN,
  password: MANAGER_PASSWORD,
});
ok(
  'деактивований не може увійти',
  loginOff.status === 403,
  `HTTP ${loginOff.status}: ${loginOff.body?.message}`,
);

// ---------- журнал дій ----------
const audit = await owner('GET', '/admin/audit?period=today&pageSize=100');
const actions = (audit.body?.data?.entries ?? []).map((e) => e.action);

ok('журнал доступний власнику', audit.status === 200, `HTTP ${audit.status}`);

for (const action of [
  'auth.login',
  'auth.login_failed',
  'admin.create',
  'admin.deactivate',
]) {
  ok(`у журналі є ${action}`, actions.includes(action));
}

if (customerId) {
  ok('у журналі є відмова операції', actions.includes('operation.topup'));
}

const byAction = await owner('GET', '/admin/audit?period=today&action=auth.login');
ok(
  'фільтр за типом дії працює',
  byAction.status === 200 &&
    (byAction.body?.data?.entries ?? []).every((e) => e.action === 'auth.login'),
);

const byAdmin = await owner(
  `GET`,
  `/admin/audit?period=today&adminId=${ownerId}`,
);
ok(
  'фільтр за адміністратором працює',
  byAdmin.status === 200 &&
    (byAdmin.body?.data?.entries ?? []).every((e) => e.adminId === ownerId),
);

ok(
  'журнал не можна змінити через API',
  (await owner('DELETE', `/admin/audit/${audit.body?.data?.entries?.[0]?.id}`))
    .status === 404,
);

// Прибирання — після перевірок журналу: вони якраз і шукають ці записи.
const removed = await cleanupTestAdmins();

console.log(
  `\nПрибрано за собою: адміністраторів ${removed?.admins ?? 0}, ` +
    `операцій ${removed?.operations ?? 0}, записів журналу ${removed?.audit ?? 0}.`,
);

console.log(failed === 0 ? 'Усе зелене.' : `Провалено перевірок: ${failed}`);

await prisma.$disconnect();
process.exit(failed > 0 ? 1 : 0);
