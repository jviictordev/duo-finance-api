import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createApp } from './app';
import { Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const config = app.get(ConfigService<Env, true>);
  const port = config.get('PORT', { infer: true });
  await app.listen({ port, host: '0.0.0.0' });
  new Logger('Bootstrap').log(`Duo Finance API on :${port}`);
}

void bootstrap();
