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
const SECRET_KEY_PATTERN = /token|apilogin|password|secret|authorization/i;

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
  saveSample(
    '03-loyalty-program.json',
    {
      request: {
        url: '/api/1/loyalty/syrve/program',
        body: { organizationId },
      },
      response: programsResponse.data,
    },
    secrets,
  );

  // 4. Підсумок — що саме вписати в .env.
  const activeProgram =
    programs.find((p) => (p.isActive ?? p.IsActive) === true) ?? programs[0];

  console.log('\n--- Що вписати в .env ---');
  console.log(`SYRVE_ORGANIZATION_ID=${organizationId}`);
  if (activeProgram) {
    console.log(`SYRVE_PROGRAM_ID=${activeProgram.id ?? activeProgram.Id}`);
  }
};

main().catch((error) => {
  console.error(`\nПомилка: ${error.message}`);
  process.exit(1);
});
