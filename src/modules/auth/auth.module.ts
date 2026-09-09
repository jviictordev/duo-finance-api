import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SpaceGuard } from './guards/space.guard';
import { TokenService } from './token.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtAuthGuard, SpaceGuard],
  exports: [AuthService, TokenService, JwtAuthGuard, SpaceGuard],
})
export class AuthModule {}
