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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentSpace,
  SpaceContext,
} from '../../common/decorators/current-space.decorator';
import { SpaceGuard } from '../auth/guards/space.guard';
import { CreateAccountDto, UpdateAccountDto } from './accounts.dto';
import { AccountsService } from './accounts.service';

@ApiTags('accounts')
@ApiBearerAuth()
@UseGuards(SpaceGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list(@CurrentSpace() space: SpaceContext) {
    return this.accounts.list(space.id);
  }

  @Post()
  create(@CurrentSpace() space: SpaceContext, @Body() dto: CreateAccountDto) {
    return this.accounts.create(space.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentSpace() space: SpaceContext,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accounts.update(space.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentSpace() space: SpaceContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.accounts.remove(space.id, id);
  }
}
