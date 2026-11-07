# Зразки відповідей Syrve Cloud API

Файли створює `node scripts/explore.js` (етап 0). Вони потрібні для двох речей:

1. зафіксувати **реальну** форму відповідей Syrve — на неї спирається мок-клієнт (`SYRVE_MODE=mock`) і мапінг типів транзакцій;
2. мати що показати, коли доступу до Syrve немає.

Зібрано 07.11.2026 на тестовій організації «Демо В.С.».

## Правило безпеки

Репозиторій відкритий. Скрипт перед записом замінює на `<redacted>`:

- значення полів, чиї імена схожі на секрет (`token`, `apiLogin`, `apiClientLogin`, `password`, `secret`, `authorization`);
- будь-яке входження відомих секретів у текст (Syrve повторює `apiLogin` у повідомленні помилки 401).

Id організації, програми, гаманця й гостя — не секрети, вони лишаються як є.

Окремо: з `03-loyalty-program.json` прибрано `marketingCampaigns` — це конфігурація маркетингових кампаній замовника (правила нарахування, умови, відсотки). Мок-клієнту вона не потрібна, а репозиторій відкритий.

## Файли

| Файл | Метод | Що з нього дізналися |
|---|---|---|
| `01-access_token.json` | `access_token` | Відповідь — `{correlationId, token}` |
| `02-organizations.json` | `organizations` | Одна організація, поля `id`, `name`, `code` |
| `03-loyalty-program.json` | `loyalty/syrve/program` | Поле називається **`Programs`** з великої; активних програм **чотири** |
| `04-customer-create_or_update.json` | `customer/create_or_update` | Повертає `{id}` |
| `05-customer-program-add.json` | `customer/program/add` | Повертає `{userWalletId, walletId}` |
| `06-customer-card-add.json` | `customer/card/add` | Повертає `{}` |
| `07-customer-info.json` | `customer/info` (phone) | `cards[{id, track, number, validToDate}]`, `walletBalances[{id, name, type, balance}]` — по гаманцю на кожну програму |
| `08-customer-wallet-topup.json` | `customer/wallet/topup` | Повертає `{}` |
| `09-customer-wallet-chargeoff.json` | `customer/wallet/chargeoff` | Повертає `{}` |
| `10-chargeoff-over-balance.json` | `customer/wallet/chargeoff` | **Syrve дозволяє списати більше за баланс** — баланс пішов у −999993 |
| `11-customer-transactions-by_revision.json` | `customer/transactions/by_revision` | `type` — числовий код, `typeName` — назва; `revision` ~5,2 млрд; `balanceAfter` буває `null` |
| `12-customer-info-not-found.json` | `customer/info` | «Гостя немає» — це **400** `Transport_WrongCustomerNumber`, формат помилки інший, ніж у транспортних методів |
| `13-customer-info-by-id.json` | `customer/info` (id) | `type: "id"` працює — на цьому тримається пошук гостя в панелі |
| `14-program-add-repeat.json` | `customer/program/add` | Повторне додавання в програму **не** дає помилки |
| `15-card-add-duplicate.json` | `customer/card/add` | Конфлікт номера: 400 `Validation_CommonValidationError`, `Card with track=... already exists.` |

Що саме з цього довелося виправити в коді — у `docs/PLAN.md`, розділ «Розбіжності між припущеннями і живим API».

## Повторний збір

```bash
node scripts/explore.js                   # токен, організації, програми
node scripts/explore.js --with-customer    # + гість, картка, баланс, транзакції
```

Прапорець `--with-customer` створює тестового гостя `+380991000001` у тестовій організації — ТЗ це дозволяє (розділ 2). Без прапорця скрипт нічого в Syrve не змінює.
