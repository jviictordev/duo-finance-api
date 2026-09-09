import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import {
  CurrentSpace,
  SpaceContext,
} from '../../common/decorators/current-space.decorator';
import { SpaceGuard } from '../auth/guards/space.guard';
import {
  CreateRecurringAccountDto,
  PayRecurringAccountDto,
  UpdateRecurringAccountDto,
} from './recurring-accounts.dto';
import { RecurringAccountsService } from './recurring-accounts.service';

@ApiTags('recurring-accounts')
@ApiBearerAuth()
@UseGuards(SpaceGuard)
@Controller('recurring-accounts')
export class RecurringAccountsController {
  constructor(private readonly recurring: RecurringAccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Contas fixas + bloco "Parcelas em andamento"' })
  list(@CurrentSpace() space: SpaceContext) {
    return this.recurring.list(space.id);
  }

  @Post()
  create(
    @CurrentSpace() space: SpaceContext,
    @Body() dto: CreateRecurringAccountDto,
  ) {
    return this.recurring.create(space.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentSpace() space: SpaceContext,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringAccountDto,
  ) {
    return this.recurring.update(space.id, id, dto);
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'Registra o pagamento → cria lançamento' })
  pay(
    @CurrentSpace() space: SpaceContext,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PayRecurringAccountDto,
  ) {
    return this.recurring.pay(space.id, user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentSpace() space: SpaceContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.recurring.remove(space.id, id);
  }
}
