# Один образ для двох контейнерів: api (HTTP) і worker (черги, бот, поллер).
# Відрізняються лише командою запуску в docker-compose.yml.
FROM node:22-slim

# openssl потрібен Prisma Query Engine для підключення до PostgreSQL.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Спочатку маніфести й схема — так Docker кешує шар з npm install
# і не перевстановлює залежності при кожній правці коду.
COPY package*.json ./
COPY prisma ./prisma

# postinstall сам викличе prisma generate.
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
