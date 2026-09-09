# duo-finance-api

API do Duo Finance — finanças compartilhadas de uma dupla.

## Stack

| Camada | Escolha |
|---|---|
| Runtime | Node 22 + TypeScript |
| Framework | NestJS 11 (adapter Fastify) |
| ORM / Banco | Prisma 6 + PostgreSQL 16 |
| Validação | Zod (`nestjs-zod`) |
| Auth | JWT próprio: access 15min + refresh opaco rotativo (detecção de reuso), argon2id |
| Dinheiro | `BigInt` centavos + `Money` value object; JSON sempre em string de centavos |
| Realtime | SSE (`GET /stream`) — pub/sub Redis pendente para multi-instância |
| Logs / Docs | `nestjs-pino` / Swagger em `/docs` (dev) |
| Storage anexos | S3/R2/MinIO quando as chaves `S3_*` estão definidas; senão disco local (dev) |
| Deploy | Docker Compose + Caddy (TLS automático) no VPS; CI em GitHub Actions — ver [DEPLOY.md](DEPLOY.md) |

## Setup local

Pré-requisito: PostgreSQL (e opcionalmente Redis/MinIO). Com Docker:

```bash
docker compose up -d          # postgres + redis + minio
cp .env.example .env          # ajuste os segredos
npm install
npx prisma migrate deploy     # aplica prisma/migrations
npm run db:seed               # tabelas INSS/IRRF
npm run start:dev
```

API em `http://localhost:3333`, docs em `http://localhost:3333/docs`.

Sem Docker: suba um Postgres qualquer e aponte `DATABASE_URL` no `.env`.

## Testar no iPhone (front Ionic/Capacitor)

iOS bloqueia HTTP — a API precisa de HTTPS. Para desenvolvimento:

```bash
# túnel https -> localhost:3333 (instale o cloudflared)
cloudflared tunnel --url http://localhost:3333
```

Use a URL `https://…trycloudflare.com` como `server.url` no Capacitor
(`ionic cap run ios --livereload --external`) e adicione-a em `CORS_ORIGINS`.
Origens do Capacitor já liberadas por padrão: `capacitor://localhost`,
`https://localhost`, `ionic://localhost`.

## Autenticação (resumo para o front)

1. `POST /api/auth/register` ou `/login` → `{ accessToken, refreshToken, user }`
2. Enviar `Authorization: Bearer <accessToken>` nas chamadas
3. Guardar `refreshToken` em **secure storage** (não `localStorage`)
4. Em 401, `POST /api/auth/refresh { refreshToken }` → novos tokens (o antigo é revogado)
5. SSE: `POST /api/auth/stream-token` → abrir `GET /stream?token=<token>` com `EventSource`

## Onboarding da dupla

`POST /api/space` (cria + categorias padrão) → `POST /api/space/invitations { email }`
(token volta na resposta enquanto não há e-mail) → a 2ª pessoa se cadastra e faz
`POST /api/space/invitations/accept { token }`.

## Rotas principais (todas sob `/api`, exigem Bearer + espaço)

| Tela | Método/rota |
|---|---|
| /mes | `GET /dashboard?month=YYYY-MM` |
| Lançamentos | `GET/POST /transactions`, `GET/PATCH/DELETE /transactions/:id`, `POST /transactions/transfer` |
| Detalhe (comentários) | `GET/POST /transactions/:id/comments` |
| Recibos | `POST /attachments` (multipart `file`), `GET /attachments/:id/raw|thumb` |
| /contas-fixas | `GET/POST /recurring-accounts`, `POST /recurring-accounts/:id/pay` |
| /reserva | `GET /emergency-fund`, `POST /emergency-fund/movements`, `PATCH /emergency-fund` |
| /fechamento | `GET /month-closing?month=`, `POST /month-closing` |
| /renda | `GET /income`, `PUT /income/sources` |
| /atividade | `GET /activity?cursor=` |
| realtime | `GET /stream?token=` (SSE) |

## Scripts

| Comando | Ação |
|---|---|
| `npm run start:dev` | API em watch |
| `npm run prisma:migrate` | cria migration (dev) |
| `npm run db:seed` | seed idempotente (impostos) |
| `npm test` | Vitest |
| `npm run lint` | ESLint |
| `npm run build` | compila para `dist/` |

## Pendências conhecidas (pós-scaffold)

- Reações (modelo existe; sem endpoints — decisão do produto)
- Redis pub/sub no SSE para múltiplas instâncias
- `GET /quick-expenses` (atalhos de gastos recorrentes)
- Introspecção dos schemas Zod no Swagger
- Envio de e-mail de convite (hoje o token volta na resposta)
