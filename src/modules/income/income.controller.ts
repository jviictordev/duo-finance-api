import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import {
  CurrentSpace,
  SpaceContext,
} from '../../common/decorators/current-space.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { SpaceGuard } from '../auth/guards/space.guard';
import { IncomeService } from './income.service';

const cents = z
  .union([z.string().regex(/^\d+$/), z.number().int().nonnegative()])
  .transform((v) => BigInt(v));

class SourcesDto extends createZodDto(
  z.object({
    sources: z
      .array(
        z.object({
          label: z.string().min(1).max(80),
          kind: z.enum(['FIXED', 'VARIABLE']).default('FIXED'),
          grossCents: cents.default('0'),
          applyInss: z.boolean().default(true),
          applyIrrf: z.boolean().default(true),
          dependents: z.number().int().min(0).max(20).default(0),
        }),
      )
      .max(10),
  }),
) {}

@ApiTags('income')
@ApiBearerAuth()
@UseGuards(SpaceGuard)
@Controller('income')
export class IncomeController {
  constructor(
    private readonly income: IncomeService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: '/renda — fontes + líquido (INSS/IRRF por vigência)' })
  async summary(@CurrentSpace() space: SpaceContext) {
    const members = await this.prisma.spaceMember.findMany({
      where: { spaceId: space.id },
      select: { userId: true },
    });
    return this.income.summary(
      space.id,
      members.map((m) => m.userId),
    );
  }

  @Put('sources')
  @ApiOperation({ summary: 'Substitui as fontes de renda do usuário atual' })
  replace(@CurrentUser() user: AuthUser, @Body() dto: SourcesDto) {
    return this.income.replaceSources(user.id, dto.sources);
  }
}
