# --- builder ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# --- runtime ---
FROM node:20-alpine AS runtime

WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER app

EXPOSE 3000

CMD ["node", "dist/server.js"]
