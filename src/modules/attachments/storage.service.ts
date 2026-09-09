import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { del as blobDel, put as blobPut } from '@vercel/blob';
import { Env } from '../../config/env';

export const STORAGE = Symbol('STORAGE');

export interface Storage {
  /**
   * Faz o upload e devolve a **chave a persistir** no banco
   * (caminho relativo no disco, ou a URL pública no Vercel Blob).
   */
  put(key: string, data: Buffer, contentType?: string): Promise<string>;
  /** Lê os bytes a partir da chave persistida. */
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Gera um pathname único para um novo arquivo. */
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

  async put(key: string, data: Buffer): Promise<string> {
    const path = this.safePath(key);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, data);
    return key;
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

/**
 * Vercel Blob (BLOB_READ_WRITE_TOKEN). A chave persistida é a URL pública
 * retornada pelo `put` — os bytes são relidos via `fetch` para manter o
 * controle de acesso na API (o front nunca recebe a URL do Blob direto).
 */
export class VercelBlobStorage implements Storage {
  private readonly logger = new Logger(VercelBlobStorage.name);

  constructor(private readonly token: string) {}

  async put(key: string, data: Buffer, contentType?: string): Promise<string> {
    const blob = await blobPut(key, data, {
      access: 'public',
      token: this.token,
      addRandomSuffix: true,
      contentType,
    });
    return blob.url;
  }

  async get(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Blob ${res.status} em ${url}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(url: string): Promise<void> {
    try {
      await blobDel(url, { token: this.token });
    } catch (err) {
      this.logger.warn(`Falha ao remover ${url}: ${String(err)}`);
    }
  }

  keyFor(spaceId: string, filename: string): string {
    return buildKey(spaceId, filename);
  }
}

/**
 * Seleção automática: `BLOB_READ_WRITE_TOKEN` presente → Vercel Blob;
 * senão, disco local.
 */
export function createStorage(config: ConfigService<Env, true>): Storage {
  const token = config.get('BLOB_READ_WRITE_TOKEN', { infer: true });

  if (token) {
    new Logger('Storage').log('Vercel Blob ativo');
    return new VercelBlobStorage(token);
  }

  new Logger('Storage').warn(
    'BLOB_READ_WRITE_TOKEN ausente — usando disco local (anexos somem a cada deploy).',
  );
  return new DiskStorage();
}
