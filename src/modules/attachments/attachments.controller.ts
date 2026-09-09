import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyReply, FastifyRequest } from 'fastify';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import {
  CurrentSpace,
  SpaceContext,
} from '../../common/decorators/current-space.decorator';
import { SpaceGuard } from '../auth/guards/space.guard';
import { AttachmentsService } from './attachments.service';

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(SpaceGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload de recibo (campo "file"); devolve id + thumbUrl' })
  async upload(
    @CurrentSpace() space: SpaceContext,
    @CurrentUser() user: AuthUser,
    @Req() req: FastifyRequest,
  ) {
    const file = await req.file();
    if (!file) throw new BadRequestException('Envie um arquivo no campo "file".');
    const buffer = await file.toBuffer();
    return this.attachments.upload(space.id, user.id, {
      filename: file.filename,
      mimetype: file.mimetype,
      buffer,
    });
  }

  @Get(':id/raw')
  async raw(
    @CurrentSpace() space: SpaceContext,
    @Param('id') id: string,
    @Res() reply: FastifyReply,
  ) {
    const { buffer, mime } = await this.attachments.read(space.id, id, 'raw');
    void reply.header('Content-Type', mime).send(buffer);
  }

  @Get(':id/thumb')
  async thumb(
    @CurrentSpace() space: SpaceContext,
    @Param('id') id: string,
    @Res() reply: FastifyReply,
  ) {
    const { buffer, mime } = await this.attachments.read(space.id, id, 'thumb');
    void reply.header('Content-Type', mime).send(buffer);
  }
}
