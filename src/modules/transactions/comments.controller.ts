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
import { CommentsService } from './comments.service';

class CreateCommentDto extends createZodDto(
  z.object({ body: z.string().min(1).max(2000) }),
) {}

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(SpaceGuard)
@Controller('transactions/:transactionId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(
    @CurrentSpace() space: SpaceContext,
    @Param('transactionId') transactionId: string,
  ) {
    return this.comments.list(space.id, transactionId);
  }

  @Post()
  create(
    @CurrentSpace() space: SpaceContext,
    @CurrentUser() user: AuthUser,
    @Param('transactionId') transactionId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(space.id, user.id, transactionId, dto.body);
  }

  @Delete(':commentId')
  @HttpCode(204)
  remove(
    @CurrentSpace() space: SpaceContext,
    @CurrentUser() user: AuthUser,
    @Param('commentId') commentId: string,
  ): Promise<void> {
    return this.comments.remove(space.id, user.id, commentId);
  }
}
