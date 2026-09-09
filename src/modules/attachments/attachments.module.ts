import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { createStorage, STORAGE } from './storage.service';

@Module({
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    {
      provide: STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => createStorage(config),
    },
  ],
})
export class AttachmentsModule {}
