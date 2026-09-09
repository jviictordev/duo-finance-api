import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
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
  CreateTransactionDto,
  CreateTransferDto,
  ListTransactionsQueryDto,
  UpdateTransactionDto,
} from './transactions.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(SpaceGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista lançamentos (filtro por mês/período/conta)' })
  list(
    @CurrentSpace() space: SpaceContext,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.transactions.list(space.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Registra gasto/entrada (parcelas só em CREDIT)' })
  create(
    @CurrentSpace() space: SpaceContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactions.create(space.id, user.id, dto);
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Transferência entre contas (par vinculado)' })
  transfer(
    @CurrentSpace() space: SpaceContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTransferDto,
  ) {
    return this.transactions.transfer(space.id, user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do lançamento (sheet): meta, recibo, comentários' })
  detail(@CurrentSpace() space: SpaceContext, @Param('id') id: string) {
    return this.transactions.detail(space.id, id);
  }

  @Patch(':id')
  update(
    @CurrentSpace() space: SpaceContext,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactions.update(space.id, user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentSpace() space: SpaceContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.transactions.remove(space.id, id);
  }
}
