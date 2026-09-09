import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';

/**
 * Storage de anexos. Implementação atual: disco local (./storage).
 * TODO: trocar por S3/R2/MinIO (S3_* no .env) usando @aws-sdk/client-s3 —
 * a interface (put/get/delete por key) já isola o resto do código.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly root = join(process.cwd(), 'storage', 'attachments');

  private safePath(key: string): string {
    const clean = key.replace(/[^a-zA-Z0-9._/-]/g, '_');
    return join(this.root, clean);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.safePath(key);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, data);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.safePath(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.safePath(key));
    } catch (err) {
      this.logger.warn(`Falha ao remover ${key}: ${String(err)}`);
    }
  }

  keyFor(spaceId: string, filename: string): string {
    const hash = createHash('sha1')
      .update(`${spaceId}:${filename}:${Date.now()}`)
      .digest('hex')
      .slice(0, 16);
    return `${spaceId}/${hash}-${filename}`;
  }
}
