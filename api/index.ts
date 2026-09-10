import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';

let cached: FastifyInstance | null = null;

async function getServer(): Promise<FastifyInstance> {
  if (cached) return cached;
  // import da app COMPILADA (dist/, gerado no build). Lazy para que uma falha
  // de carregamento caia no catch do handler em vez de virar um crash opaco.
  // @ts-expect-error dist/ não existe até `npm run build`
  const { createApp } = await import('../dist/app.js');
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
  try {
    const fastify = await getServer();
    fastify.server.emit('request', req, res);
  } catch (err) {
    // stack completo vai para os logs da função (vercel logs / dashboard)
    // eslint-disable-next-line no-console
    console.error('BOOT FAILURE', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'boot_failure' }));
  }
}
