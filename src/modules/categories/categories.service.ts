import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(spaceId: string, includeArchived = false) {
    return this.prisma.category.findMany({
      where: { spaceId, archivedAt: includeArchived ? undefined : null },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });
  }

  create(spaceId: string, dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: { spaceId, ...dto } });
  }

  async update(spaceId: string, id: string, dto: UpdateCategoryDto) {
    await this.ensureOwned(spaceId, id);
    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        essential: dto.essential,
        icon: dto.icon === null ? null : dto.icon,
        color: dto.color === null ? null : dto.color,
        archivedAt:
          dto.archived === undefined
            ? undefined
            : dto.archived
              ? new Date()
              : null,
      },
    });
  }

  async remove(spaceId: string, id: string): Promise<void> {
    await this.ensureOwned(spaceId, id);
    const used = await this.prisma.transaction.count({
      where: { categoryId: id },
    });
    if (used > 0) {
      await this.prisma.category.update({
        where: { id },
        data: { archivedAt: new Date() },
      });
      return;
    }
    await this.prisma.category.delete({ where: { id } });
  }

  private async ensureOwned(spaceId: string, id: string): Promise<void> {
    const found = await this.prisma.category.findFirst({
      where: { id, spaceId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Categoria não encontrada.');
  }
}
