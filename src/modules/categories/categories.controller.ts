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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentSpace,
  SpaceContext,
} from '../../common/decorators/current-space.decorator';
import { SpaceGuard } from '../auth/guards/space.guard';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(SpaceGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(
    @CurrentSpace() space: SpaceContext,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.categories.list(space.id, includeArchived === 'true');
  }

  @Post()
  create(@CurrentSpace() space: SpaceContext, @Body() dto: CreateCategoryDto) {
    return this.categories.create(space.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentSpace() space: SpaceContext,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(space.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentSpace() space: SpaceContext,
    @Param('id') id: string,
  ): Promise<void> {
    return this.categories.remove(space.id, id);
  }
}
