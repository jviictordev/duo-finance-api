import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';

let cached: FastifyInstance | null = null;

async function getServer(): Promise<FastifyInstance> {
  if (cached) return cached;
  // import lazy da app COMPILADA (dist/, gerado no build) — assim uma falha de
  // resolução/carregamento de módulo nativo cai no catch do handler
  // @ts-expect-error dist/ não existe em dev
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
    // eslint-disable-next-line no-console
    console.error('BOOT FAILURE', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'boot_failure',
        message: err instanceof Error ? err.message : String(err),
        stack:
          err instanceof Error ? err.stack?.split('\n').slice(0, 15) : undefined,
      }),
    );
  }
}
