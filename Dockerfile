# ─── build ─────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
# openssl para o Prisma; toolchain como fallback caso sharp não tenha prebuild
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci
RUN npx prisma generate
COPY . .
RUN npm run build
# prune tira devDeps; regenera o client depois (o prune pode limpar .prisma)
RUN npm prune --omit=dev && npx prisma generate

# ─── runtime ───────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./
COPY docker/entrypoint.sh ./docker/entrypoint.sh
COPY package.json ./

# roda como usuário não-root; storage precisa ser gravável
RUN chmod +x docker/entrypoint.sh \
    && mkdir -p storage/attachments \
    && chown -R node:node /app
USER node

EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3333)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker/entrypoint.sh"]
CMD ["node", "dist/main.js"]
