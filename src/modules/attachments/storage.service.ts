import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env';

export const STORAGE = Symbol('STORAGE');

export interface Storage {
  put(key: string, data: Buffer, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  keyFor(spaceId: string, filename: string): string;
}

function buildKey(spaceId: string, filename: string): string {
  const hash = createHash('sha1')
    .update(`${spaceId}:${filename}:${Date.now()}`)
    .digest('hex')
    .slice(0, 16);
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${spaceId}/${hash}-${safeName}`;
}

/** Disco local — fallback para dev. Anexos NÃO sobrevivem a redeploy. */
@Injectable()
export class DiskStorage implements Storage {
  private readonly logger = new Logger(DiskStorage.name);
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

  get(key: string): Promise<Buffer> {
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
    return buildKey(spaceId, filename);
  }
}

/** S3 compatível: AWS S3, Cloudflare R2 ou MinIO (S3_* no .env). */
export class S3Storage implements Storage {
  private readonly logger = new Logger(S3Storage.name);

  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async put(key: string, data: Buffer, contentType?: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Objeto vazio: ${key}`);
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      this.logger.warn(`Falha ao remover ${key}: ${String(err)}`);
    }
  }

  keyFor(spaceId: string, filename: string): string {
    return buildKey(spaceId, filename);
  }
}

/**
 * Escolhe a implementação: se S3_ENDPOINT + S3_BUCKET + credenciais estiverem
 * definidos, usa S3; caso contrário, disco local.
 */
export function createStorage(config: ConfigService<Env, true>): Storage {
  const endpoint = config.get('S3_ENDPOINT', { infer: true });
  const bucket = config.get('S3_BUCKET', { infer: true });
  const accessKeyId = config.get('S3_ACCESS_KEY_ID', { infer: true });
  const secretAccessKey = config.get('S3_SECRET_ACCESS_KEY', { infer: true });

  if (endpoint && bucket && accessKeyId && secretAccessKey) {
    const client = new S3Client({
      region: config.get('S3_REGION', { infer: true }),
      endpoint,
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
      credentials: { accessKeyId, secretAccessKey },
    });
    new Logger('Storage').log(`S3 storage ativo (bucket ${bucket})`);
    return new S3Storage(client, bucket);
  }

  new Logger('Storage').warn(
    'S3 não configurado — usando disco local (anexos somem a cada deploy).',
  );
  return new DiskStorage();
}
