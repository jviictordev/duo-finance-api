import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentSpace,
  SpaceContext,
} from '../../common/decorators/current-space.decorator';
import { SpaceGuard } from '../auth/guards/space.guard';
import { ActivityService } from './activity.service';

@ApiTags('activity')
@ApiBearerAuth()
@UseGuards(SpaceGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  @ApiOperation({ summary: 'Feed de atividade (paginado por cursor)' })
  feed(
    @CurrentSpace() space: SpaceContext,
    @Query('cursor') cursor?: string,
  ) {
    return this.activity.feed(space.id, cursor);
  }
}
