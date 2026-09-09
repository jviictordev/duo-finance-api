import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';
// importa a app JÁ COMPILADA (dist/) — evita recompilar decorators no bundle da Vercel
// @ts-expect-error dist/ é gerado no build (npm run vercel-build)
import { createApp } from '../dist/app.js';

let cached: FastifyInstance | null = null;

async function getServer(): Promise<FastifyInstance> {
  if (cached) return cached;
  const app = await createApp();
  await app.init();
  const fastify = app.getHttpAdapter().getInstance() as FastifyInstance;
  await fastify.ready();
  cached = fastify;
  return cached;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const fastify = await getServer();
  fastify.server.emit('request', req, res);
}
