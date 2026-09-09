# ─── build ─────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci
RUN npx prisma generate
COPY . .
RUN npm run build && npm prune --omit=dev

# ─── runtime ───────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./
COPY package.json ./
EXPOSE 3333
# roda migrations pendentes e sobe a API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
