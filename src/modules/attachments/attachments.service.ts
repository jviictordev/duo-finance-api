import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttachmentKind } from '@prisma/client';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { Storage, STORAGE } from './storage.service';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  async upload(
    spaceId: string,
    userId: string,
    file: { filename: string; mimetype: string; buffer: Buffer },
  ) {
    if (!ALLOWED.has(file.mimetype)) {
      throw new BadRequestException('Tipo de arquivo não suportado.');
    }
    if (file.buffer.byteLength > 10 * 1024 * 1024) {
      throw new BadRequestException('Arquivo acima de 10 MB.');
    }

    const key = this.storage.keyFor(spaceId, file.filename);
    await this.storage.put(key, file.buffer, file.mimetype);

    let thumbKey: string | null = null;
    if (file.mimetype.startsWith('image/')) {
      try {
        const thumb = await sharp(file.buffer)
          .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 70 })
          .toBuffer();
        thumbKey = `${key}.thumb.webp`;
        await this.storage.put(thumbKey, thumb, 'image/webp');
      } catch {
        thumbKey = null;
      }
    }

    const attachment = await this.prisma.attachment.create({
      data: {
        spaceId,
        uploadedById: userId,
        kind: AttachmentKind.RECEIPT,
        storageKey: key,
        thumbKey,
        mime: file.mimetype,
        sizeBytes: file.buffer.byteLength,
      },
    });

    return {
      id: attachment.id,
      mime: attachment.mime,
      sizeBytes: attachment.sizeBytes,
      url: `/api/attachments/${attachment.id}/raw`,
      thumbUrl: thumbKey ? `/api/attachments/${attachment.id}/thumb` : null,
    };
  }

  async read(spaceId: string, id: string, variant: 'raw' | 'thumb') {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id, spaceId },
    });
    if (!attachment) throw new NotFoundException('Anexo não encontrado.');

    const key =
      variant === 'thumb' && attachment.thumbKey
        ? attachment.thumbKey
        : attachment.storageKey;
    const mime =
      variant === 'thumb' && attachment.thumbKey ? 'image/webp' : attachment.mime;

    return { buffer: await this.storage.get(key), mime };
  }
}
