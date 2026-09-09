# Deploy — Duo Finance API

Stack de produção: **Docker Compose** (api + Postgres + Redis + Caddy) num VPS.
Caddy termina TLS automaticamente (Let's Encrypt).

```
Internet ──HTTPS──> Caddy :443 ──> api :3333 ──> Postgres :5432
                                            └──> Redis :6379
```

---

## 1. Pré-requisitos no VPS

- Docker Engine + plugin Compose (`docker compose version`)
- Portas 80 e 443 abertas
- Um domínio apontando para o IP do VPS:
  - `api.SEUDOMINIO` → A record para o VPS (usado pelo Caddy / `CADDY_SITE`)
- Bucket S3/R2 criado para os anexos (Cloudflare R2 recomendado)

## 2. Primeiro deploy (manual)

```bash
# no VPS, como o usuário de deploy
git clone git@github.com:jviictordev/duo-finance-api.git
cd duo-finance-api

cp .env.production.example .env.production
# edite .env.production — ver seção 4

docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

O container `api` roda `prisma migrate deploy` e o seed (idempotente) no start,
via `docker/entrypoint.sh`, antes de subir o servidor.

Verificação:
```bash
curl -s https://api.SEUDOMINIO/health      # {"status":"ok","db":"ok",...}
```

## 3. Deploy contínuo (GitHub Actions)

`.github/workflows/ci.yml` → job `deploy` roda em push na `main` (depois de
`test` + build da imagem). Configure os **secrets** do repositório:

| Secret | Valor |
|---|---|
| `DEPLOY_HOST` | IP ou host do VPS |
| `DEPLOY_USER` | usuário SSH |
| `DEPLOY_SSH_KEY` | chave privada SSH (a pública no `authorized_keys` do VPS) |
| `DEPLOY_PATH` | caminho do repo no VPS (ex.: `/home/deploy/duo-finance-api`) |

O job faz `git reset --hard origin/main` + `docker compose ... up -d --build`.
O `.env.production` **fica só no VPS** (não é versionado).

## 4. `.env.production` — o que preencher

| Chave | Observação |
|---|---|
| `CORS_ORIGINS` | domínio(s) do front em produção + origens do Capacitor |
| `POSTGRES_PASSWORD` / `DATABASE_URL` | mesma senha nos dois; host = `postgres` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | R2/S3 — **obrigatório**, senão anexos vão pra disco e somem no redeploy |
| `S3_PUBLIC_URL` | base pública do bucket (se for servir direto) |
| `CADDY_SITE` | domínio da API (ex.: `api.duofinance.app`) |
| `MAIL_TRANSPORT` | `console` até ter SMTP; convite volta na resposta da API |

## 5. Operação

```bash
# logs
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api

# migration manual (normalmente automático no start)
docker compose --env-file .env.production -f docker-compose.prod.yml exec api npx prisma migrate deploy

# backup do banco
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U duo duo_finance | gzip > backup-$(date +%F).sql.gz

# restore
gunzip -c backup-XXXX.sql.gz | docker compose --env-file .env.production \
  -f docker-compose.prod.yml exec -T postgres psql -U duo -d duo_finance
```

## 6. Notas / limites atuais

- **1 instância da API** — o rate-limit e o barramento SSE são em memória.
  Para escalar horizontalmente: ligar o `DomainEventsService` ao Redis (pub/sub)
  e usar `@nestjs/throttler` com storage Redis.
- `prisma migrate deploy` roda no start de cada container — com réplicas isso
  precisaria virar um job único (init container).
- Sem e-mail de convite ainda (`MAIL_TRANSPORT=console`).
- Backups do Postgres não são automáticos — agende o `pg_dump` (cron) e mande
  para fora do VPS.
