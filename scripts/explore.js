/**
 * Етап 0 — розвідка Syrve Cloud API.
 *
 * Що робить:
 *   1. читає .env (без залежностей — скрипт має працювати ще до npm install);
 *   2. отримує токен доступу за apiLogin;
 *   3. тягне список організацій і програм лояльності;
 *   4. складає відповіді в docs/api-samples/*.json, замінивши ключі й токени
 *      на "<redacted>" — ці файли лежать у публічному репозиторії і стануть
 *      основою для мок-клієнта.
 *
 * Запуск:  node scripts/explore.js
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SAMPLES_DIR = path.join(ROOT, 'docs', 'api-samples');
const REQUEST_TIMEOUT_MS = 15000;

// ---------- .env ----------

/**
 * Мінімальний парсер .env: KEY=VALUE, рядки з # і порожні — пропускаємо.
 * Свідомо не тягнемо dotenv, щоб етап 0 не залежав від npm install.
 */
const readEnvFile = (filePath) => {
  const env = {};
  let raw;

  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    throw new Error(
      `Не знайдено ${filePath}. Скопіюй .env.example у .env і заповни значення.`,
    );
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    // Знімаємо лапки, якщо значення взяте в них.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
};

const requireEnv = (env, name) => {
  const value = env[name];
  if (!value) throw new Error(`У .env не заповнено ${name}`);
  return value;
};

// ---------- Секрети ----------

/** Замінює відомі секрети в довільному тексті (повідомлення помилок, логи). */
const hideSecrets = (text, secrets = []) => {
  let result = String(text);
  for (const secret of secrets) {
    if (secret && result.includes(secret)) {
      result = result.split(secret).join('<redacted>');
    }
  }
  return result;
};

// ---------- HTTP ----------

/**
 * Усі методи Syrve Cloud API — POST з JSON-тілом.
 * Токен передається заголовком Authorization: Bearer <token>.
 */
const postJson = async (url, body, token, secrets = []) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const startedAt = Date.now();

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await response.text();
  const elapsedMs = Date.now() - startedAt;

  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const details = typeof data === 'string' ? data : JSON.stringify(data);
    // Syrve повторює apiLogin у тексті помилки 401 — у консоль він піти не має.
    throw new Error(
      `POST ${url} → ${response.status}: ${hideSecrets(details, secrets)}`,
    );
  }

  return { data, elapsedMs, status: response.status };
};

// ---------- Збереження зразків ----------

/**
 * Рекурсивно замінює секрети на "<redacted>":
 *  - поля з "секретними" іменами (token, apiLogin, password...);
 *  - будь-яке входження відомих секретів у рядках (на випадок, коли API
 *    повертає ключ усередині тексту помилки).
 */
const SECRET_KEY_PATTERN =
  /token|apilogin|apiclientlogin|clientlogin|password|secret|authorization/i;

const redact = (value, secrets) => {
  if (typeof value === 'string') {
    let result = value;
    for (const secret of secrets) {
      if (secret && result.includes(secret)) {
        result = result.split(secret).join('<redacted>');
      }
    }
    return result;
  }

  if (Array.isArray(value)) return value.map((item) => redact(item, secrets));

  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] =
        SECRET_KEY_PATTERN.test(key) && typeof item === 'string'
          ? '<redacted>'
          : redact(item, secrets);
    }
    return result;
  }

  return value;
};

const saveSample = (fileName, payload, secrets) => {
  mkdirSync(SAMPLES_DIR, { recursive: true });

  const filePath = path.join(SAMPLES_DIR, fileName);
  const safe = redact(payload, secrets);

  writeFileSync(filePath, `${JSON.stringify(safe, null, 2)}\n`, 'utf8');
  console.log(`  → збережено docs/api-samples/${fileName}`);
};

// ---------- Розвідка ----------

const main = async () => {
  const env = readEnvFile(path.join(ROOT, '.env'));

  const apiUrl = (
    env.SYRVE_API_URL || 'https://api-eu.syrve.live'
  ).replace(/\/+$/, '');
  const apiLogin = requireEnv(env, 'SYRVE_API_LOGIN');

  const secrets = [apiLogin];

  console.log(`База API: ${apiUrl}`);
  console.log(`apiLogin: ${'*'.repeat(8)} (довжина ${apiLogin.length})\n`);

  // 1. Токен доступу. Живе 1 годину, тому в сервісі його кешуємо.
  console.log('1) POST /api/1/access_token');
  const tokenResponse = await postJson(
    `${apiUrl}/api/1/access_token`,
    { apiLogin },
    null,
    secrets,
  );

  // API повертає або рядок у лапках, або {token: "..."} — покриваємо оба випадки.
  const token =
    typeof tokenResponse.data === 'string'
      ? tokenResponse.data
      : tokenResponse.data?.token;

  if (!token) throw new Error('У відповіді немає токена');

  secrets.push(token);

  console.log(
    `   отримано токен: довжина ${token.length}, ${tokenResponse.elapsedMs} мс`,
  );
  saveSample(
    '01-access_token.json',
    {
      request: { url: '/api/1/access_token', body: { apiLogin: '<redacted>' } },
      response: tokenResponse.data,
      note: 'Токен діє 1 годину. Значення замінено на <redacted>.',
    },
    secrets,
  );

  // 2. Організації.
  console.log('\n2) POST /api/1/organizations');
  const orgsResponse = await postJson(
    `${apiUrl}/api/1/organizations`,
    { returnAdditionalInfo: false, includeDisabled: false },
    token,
    secrets,
  );

  const organizations = orgsResponse.data?.organizations ?? [];
  console.log(`   організацій: ${organizations.length}`);
  for (const org of organizations) {
    console.log(`   - ${org.name} | id=${org.id}`);
  }
  saveSample(
    '02-organizations.json',
    {
      request: {
        url: '/api/1/organizations',
        body: { returnAdditionalInfo: false, includeDisabled: false },
      },
      response: orgsResponse.data,
    },
    secrets,
  );

  // 3. Програми лояльності вибраної організації.
  const organizationId = env.SYRVE_ORGANIZATION_ID || organizations[0]?.id;

  if (!organizationId) {
    throw new Error('Не знайдено жодної організації — нема для чого шукати програму');
  }

  console.log(`\n3) POST /api/1/loyalty/syrve/program (organizationId=${organizationId})`);
  const programsResponse = await postJson(
    `${apiUrl}/api/1/loyalty/syrve/program`,
    { organizationId },
    token,
    secrets,
  );

  const programs =
    programsResponse.data?.programs ?? programsResponse.data?.Programs ?? [];
  console.log(`   програм: ${programs.length}`);
  for (const program of programs) {
    const id = program.id ?? program.Id;
    const name = program.name ?? program.Name;
    const walletId = program.walletId ?? program.WalletId;
    const isActive = program.isActive ?? program.IsActive;
    console.log(
      `   - ${name} | id=${id} | walletId=${walletId} | активна=${isActive}`,
    );
  }
  // Зразок зберігаємо обрізаним. Повна відповідь містить marketingCampaigns —
  // конфігурацію маркетингових кампаній замовника (правила нарахування, умови,
  // відсотки), а репозиторій відкритий. Для мок-клієнта потрібні лише ці поля.
  const PROGRAM_SAMPLE_FIELDS = [
    'id',
    'name',
    'description',
    'serviceFrom',
    'serviceTo',
    'notifyAboutBalanceChanges',
    'programType',
    'isActive',
    'walletId',
  ];

  saveSample(
    '03-loyalty-program.json',
    {
      request: {
        url: '/api/1/loyalty/syrve/program',
        body: { organizationId },
      },
      response: {
        Programs: programs.map((program) =>
          Object.fromEntries(
            PROGRAM_SAMPLE_FIELDS.map((field) => [field, program[field] ?? null]),
          ),
        ),
      },
      note: 'Прибрано marketingCampaigns — конфігурація кампаній замовника.',
    },
    secrets,
  );

  // 4. Гість, картка, баланс і транзакції.
  //
  // Створює тестового гостя в наданій тестовій організації — ТЗ це прямо
  // дозволяє (розділ 2). Виконується лише з прапорцем --with-customer,
  // щоб звичайний запуск нічого в Syrve не змінював.
  if (process.argv.includes('--with-customer')) {
    const programId = env.SYRVE_PROGRAM_ID || activeProgramId(programs);
    const phone = process.env.EXPLORE_PHONE || '+380991000001';
    const loyalty = `${apiUrl}/api/1/loyalty/syrve`;

    console.log(`\n4) POST customer/create_or_update (${phone})`);
    const created = await postJson(
      `${loyalty}/customer/create_or_update`,
      { phone, name: 'Тестовий Гість (розвідка API)', organizationId },
      token,
      secrets,
    );
    const customerId = created.data?.id ?? created.data?.customerId;
    console.log(`   customerId=${customerId}`);
    saveSample(
      '04-customer-create_or_update.json',
      { request: { url: '/customer/create_or_update', body: { phone, organizationId } }, response: created.data },
      secrets,
    );

    console.log('\n5) POST customer/program/add');
    try {
      const programAdd = await postJson(
        `${loyalty}/customer/program/add`,
        { customerId, programId, organizationId },
        token,
        secrets,
      );
      console.log('   додано в програму');
      saveSample(
        '05-customer-program-add.json',
        { request: { url: '/customer/program/add', body: { customerId, programId, organizationId } }, response: programAdd.data },
        secrets,
      );
    } catch (error) {
      // Найцінніший зразок: ТЕКСТ помилки "вже в програмі" — на нього
      // спирається ensureInProgram() у сервісі гостей.
      console.log(`   помилка (очікувана, якщо вже в програмі): ${error.message}`);
      saveSample(
        '05-customer-program-add-error.json',
        { request: { url: '/customer/program/add' }, error: error.message, note: 'Текст Syrve на повторне додавання в програму' },
        secrets,
      );
    }

    console.log('\n6) POST customer/card/add');
    const cardNumber = String(Date.now()).slice(-10);
    try {
      const cardAdd = await postJson(
        `${loyalty}/customer/card/add`,
        { customerId, cardTrack: cardNumber, cardNumber, organizationId },
        token,
        secrets,
      );
      console.log(`   видано картку ${cardNumber}`);
      saveSample(
        '06-customer-card-add.json',
        { request: { url: '/customer/card/add', body: { customerId, cardTrack: cardNumber, cardNumber, organizationId } }, response: cardAdd.data },
        secrets,
      );
    } catch (error) {
      console.log(`   помилка: ${error.message}`);
      saveSample('06-customer-card-add-error.json', { error: error.message }, secrets);
    }

    console.log('\n7) POST customer/info (type=phone)');
    const info = await postJson(
      `${loyalty}/customer/info`,
      { type: 'phone', phone, organizationId },
      token,
      secrets,
    );
    saveSample(
      '07-customer-info.json',
      { request: { url: '/customer/info', body: { type: 'phone', phone, organizationId } }, response: info.data },
      secrets,
    );
    const customer = info.data?.customer ?? info.data;
    console.log(`   name=${customer?.name}`);
    console.log(`   cards=${JSON.stringify(customer?.cards)}`);
    console.log(`   walletBalances=${JSON.stringify(customer?.walletBalances)}`);

    const wallets = customer?.walletBalances ?? [];
    const programWallet =
      wallets.find((item) => (item.id ?? item.walletId) && item.walletId === undefined) ?? wallets[0];
    const walletId = programWallet?.id ?? programWallet?.walletId ?? null;
    console.log(`   обраний walletId=${walletId}`);

    console.log('\n8) POST customer/wallet/topup (+10)');
    const topupBody = { customerId, walletId, sum: 10, comment: 'Розвідка API: нарахування', organizationId };
    const topup = await postJson(`${loyalty}/customer/wallet/topup`, topupBody, token, secrets);
    saveSample(
      '08-customer-wallet-topup.json',
      { request: { url: '/customer/wallet/topup', body: topupBody }, response: topup.data },
      secrets,
    );
    console.log(`   відповідь: ${JSON.stringify(topup.data)}`);

    console.log('\n9) POST customer/wallet/chargeoff (-4)');
    const chargeBody = { customerId, walletId, sum: 4, comment: 'Розвідка API: списання', organizationId };
    try {
      const chargeoff = await postJson(`${loyalty}/customer/wallet/chargeoff`, chargeBody, token, secrets);
      saveSample(
        '09-customer-wallet-chargeoff.json',
        { request: { url: '/customer/wallet/chargeoff', body: chargeBody }, response: chargeoff.data },
        secrets,
      );
      console.log(`   відповідь: ${JSON.stringify(chargeoff.data)}`);
    } catch (error) {
      console.log(`   помилка: ${error.message}`);
      saveSample('09-customer-wallet-chargeoff-error.json', { error: error.message }, secrets);
    }

    console.log('\n10) POST customer/wallet/chargeoff понад баланс (999999)');
    try {
      const over = await postJson(
        `${loyalty}/customer/wallet/chargeoff`,
        { customerId, walletId, sum: 999999, comment: 'Розвідка API: перебір', organizationId },
        token,
        secrets,
      );
      console.log(`   УВАГА: Syrve дозволив списати понад баланс: ${JSON.stringify(over.data)}`);
      saveSample(
        '10-chargeoff-over-balance.json',
        { response: over.data, note: 'Syrve НЕ відхилив списання понад баланс — перевірка на нашій стороні обов\'язкова' },
        secrets,
      );
    } catch (error) {
      console.log(`   відхилено: ${error.message}`);
      saveSample(
        '10-chargeoff-over-balance.json',
        { error: error.message, note: 'Текст відмови Syrve на списання понад баланс' },
        secrets,
      );
    }

    console.log('\n11) POST customer/transactions/by_revision (revision=0)');
    const txBody = { customerId, revision: 0, pageSize: 100, organizationId };
    const transactions = await postJson(
      `${loyalty}/customer/transactions/by_revision`,
      txBody,
      token,
      secrets,
    );
    saveSample(
      '11-customer-transactions-by_revision.json',
      { request: { url: '/customer/transactions/by_revision', body: txBody }, response: transactions.data },
      secrets,
    );

    const list = transactions.data?.transactions ?? [];
    console.log(`   транзакцій: ${list.length}, lastRevision=${transactions.data?.lastRevision}`);
    for (const item of list) {
      console.log(
        `   - rev=${item.revision} type=${item.type} typeName=${item.typeName} sum=${item.sum} balanceAfter=${item.balanceAfter}`,
      );
    }

    console.log('\n12) POST customer/info неіснуючого телефону');
    try {
      const missing = await postJson(
        `${loyalty}/customer/info`,
        { type: 'phone', phone: '+380999999998', organizationId },
        token,
        secrets,
      );
      console.log(`   відповідь: ${JSON.stringify(missing.data)?.slice(0, 200)}`);
      saveSample(
        '12-customer-info-not-found.json',
        { response: missing.data, note: 'Гостя немає: Syrve відповів успіхом' },
        secrets,
      );
    } catch (error) {
      console.log(`   помилка: ${error.message}`);
      saveSample(
        '12-customer-info-not-found.json',
        { error: error.message, note: 'Гостя немає: Syrve відповів помилкою — на цей текст спирається findCustomerByPhone' },
        secrets,
      );
    }
  }

  // Підсумок — що саме вписати в .env.
  console.log('\n--- Що вписати в .env ---');
  console.log(`SYRVE_ORGANIZATION_ID=${organizationId}`);
  const chosen = env.SYRVE_PROGRAM_ID || activeProgramId(programs);
  if (chosen) console.log(`SYRVE_PROGRAM_ID=${chosen}`);
};

/** Перша активна програма — запасний варіант, якщо id не заданий у .env. */
const activeProgramId = (programs) => {
  const program =
    programs.find((item) => (item.isActive ?? item.IsActive) === true) ??
    programs[0];

  return program ? (program.id ?? program.Id) : null;
};

main().catch((error) => {
  console.error(`\nПомилка: ${error.message}`);
  process.exit(1);
});
