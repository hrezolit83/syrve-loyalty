# Двоетапна збірка: node збирає бандл, nginx його віддає.
# У фінальний образ не потрапляють ні node_modules, ні вихідний код.
FROM node:22-slim AS build

WORKDIR /app

# Спочатку маніфести — так Docker кешує шар із залежностями.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
