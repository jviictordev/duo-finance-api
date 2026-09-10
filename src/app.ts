import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import fastifyCors from '@fastify/cors';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { buildCorsOrigin } from './common/cors';
import { Env } from './config/env';

// Dinheiro trafega como BigInt no domínio; na resposta JSON vira string de
// centavos inteiros ("12430"). O front formata para "R$ 124,30".
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

/**
 * Monta a aplicação Nest (sem `listen`). Usado por:
 * - `main.ts` (servidor persistente: local, Docker, VPS, Railway…)
 * - `api/index.ts` (handler serverless da Vercel)
 */
export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 15 * 1024 * 1024 }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(PinoLogger));

  const config = app.get(ConfigService<Env, true>);

  // CORS registrado direto no Fastify (antes das rotas) para o preflight
  // responder com os métodos/headers corretos, não só o OPTIONS automático.
  await app.register(fastifyCors, {
    origin: buildCorsOrigin(config.get('CORS_ORIGINS', { infer: true })),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });

  await app.register(import('@fastify/multipart'), {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });

  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
  app.setGlobalPrefix('api', { exclude: ['health', 'stream'] });
  app.enableShutdownHooks();

  if (
    config.get('NODE_ENV', { infer: true }) === 'development' &&
    !process.env.VERCEL
  ) {
    // TODO: introspecção dos schemas zod no Swagger (patch quebrado no
    // nestjs-zod@4 + @nestjs/swagger@11). Rotas e tags já aparecem em /docs.
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Duo Finance API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'docs',
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  return app;
}

export type { INestApplication };
