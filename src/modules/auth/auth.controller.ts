import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import {
  AuthUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';
import { TokenService } from './token.service';

function metaOf(req: FastifyRequest) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Cria usuário e já devolve tokens' })
  register(@Body() dto: RegisterDto, @Req() req: FastifyRequest) {
    return this.auth.register(dto, metaOf(req));
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Autentica e devolve access + refresh' })
  login(@Body() dto: LoginDto, @Req() req: FastifyRequest) {
    return this.auth.login(dto, metaOf(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotaciona o refresh token (detecção de reuso)' })
  refresh(@Body() dto: RefreshDto, @Req() req: FastifyRequest) {
    return this.auth.refresh(dto.refreshToken, metaOf(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Revoga a família do refresh token informado (público: dispensa access token válido)',
  })
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiOperation({ summary: 'Usuário autenticado + se já tem espaço' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Post('stream-token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Token efêmero para abrir o SSE em GET /stream' })
  async streamToken(@CurrentUser() user: AuthUser) {
    return { token: await this.tokens.issueStreamToken(user.id) };
  }
}
