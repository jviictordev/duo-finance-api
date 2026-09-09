import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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
import { SpaceGuard } from '../auth/guards/space.guard';
import { MonthClosingService } from './month-closing.service';

class CloseMonthDto extends createZodDto(
  z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    contributionCents: z
      .union([z.string().regex(/^\d+$/), z.number().int().nonnegative()])
      .transform((v) => BigInt(v))
      .optional(),
  }),
) {}

@ApiTags('month-closing')
@ApiBearerAuth()
@UseGuards(SpaceGuard)
@Controller('month-closing')
export class MonthClosingController {
  constructor(private readonly closing: MonthClosingService) {}

  @Get()
  @ApiOperation({ summary: '/fechamento — snapshot congelado ou preview' })
  get(@CurrentSpace() space: SpaceContext, @Query('month') month?: string) {
    return this.closing.get(space.id, month);
  }

  @Post()
  @ApiOperation({ summary: 'Fecha o mês → congela + aporte automático na reserva' })
  close(
    @CurrentSpace() space: SpaceContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CloseMonthDto,
  ) {
    return this.closing.close(space.id, user.id, dto);
  }
}
