import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
import { EmergencyFundService } from './emergency-fund.service';

const cents = z
  .union([z.string().regex(/^-?\d+$/), z.number().int()])
  .transform((v) => BigInt(v));

class MovementDto extends createZodDto(
  z.object({ amountCents: cents, note: z.string().max(140).optional() }),
) {}

class TargetDto extends createZodDto(
  z.object({
    targetCents: cents.refine((v) => v >= 0n, 'Meta não pode ser negativa'),
  }),
) {}

@ApiTags('emergency-fund')
@ApiBearerAuth()
@UseGuards(SpaceGuard)
@Controller('emergency-fund')
export class EmergencyFundController {
  constructor(private readonly fund: EmergencyFundService) {}

  @Get()
  get(@CurrentSpace() space: SpaceContext) {
    return this.fund.get(space.id);
  }

  @Patch()
  setTarget(@CurrentSpace() space: SpaceContext, @Body() dto: TargetDto) {
    return this.fund.setTarget(space.id, dto.targetCents);
  }

  @Post('movements')
  addMovement(
    @CurrentSpace() space: SpaceContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: MovementDto,
  ) {
    return this.fund.addMovement(space.id, user.id, dto);
  }
}
