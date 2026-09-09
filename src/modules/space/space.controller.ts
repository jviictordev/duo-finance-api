import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
  AcceptInvitationDto,
  CreateInvitationDto,
  CreateSpaceDto,
} from './dto/space.dto';
import { SpaceService } from './space.service';

@ApiTags('space')
@Controller('space')
export class SpaceController {
  constructor(private readonly space: SpaceService) {}

  @Post()
  @ApiOperation({ summary: 'Cria o espaço da dupla (com categorias padrão)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSpaceDto) {
    return this.space.create(user.id, dto);
  }

  @Get()
  @UseGuards(SpaceGuard)
  @ApiOperation({ summary: 'Detalhes do espaço + membros + "juntos desde"' })
  get(@CurrentSpace() space: SpaceContext) {
    return this.space.get(space.id);
  }

  @Post('invitations')
  @UseGuards(SpaceGuard)
  @ApiOperation({ summary: 'Convida a 2ª pessoa (token volta na resposta por ora)' })
  invite(
    @CurrentUser() user: AuthUser,
    @CurrentSpace() space: SpaceContext,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.space.createInvitation(space.id, user.id, space.role, dto.email);
  }

  @Get('invitations')
  @UseGuards(SpaceGuard)
  @ApiOperation({ summary: 'Lista convites do espaço' })
  listInvitations(@CurrentSpace() space: SpaceContext) {
    return this.space.listInvitations(space.id);
  }

  @Delete('invitations/:id')
  @UseGuards(SpaceGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoga um convite pendente' })
  revoke(
    @CurrentSpace() space: SpaceContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.space.revokeInvitation(space.id, id);
  }

  @Post('invitations/accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Aceita um convite (usuário autenticado, sem espaço)' })
  accept(@CurrentUser() user: AuthUser, @Body() dto: AcceptInvitationDto) {
    return this.space.acceptInvitation(user.id, dto.token);
  }
}
