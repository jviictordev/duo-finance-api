import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { IssuedTokens, TokenService } from './token.service';

interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}


  async register(
    input: { name: string; email: string; password: string },
    meta: SessionMeta,
  ): Promise<IssuedTokens & { user: PublicUser }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('E-mail já cadastrado.');
    }

    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await argonHash(input.password),
      },
    });

    const issued = await this.tokens.issueForUser(user, meta);
    return { ...issued, user: toPublicUser(user) };
  }

  async login(
    input: { email: string; password: string },
    meta: SessionMeta,
  ): Promise<IssuedTokens & { user: PublicUser }> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    const ok =
      user && (await argonVerify(user.passwordHash, input.password));
    if (!user || !ok) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const issued = await this.tokens.issueForUser(user, meta);
    return { ...issued, user: toPublicUser(user) };
  }

  async refresh(refreshToken: string, meta: SessionMeta): Promise<IssuedTokens> {
    return this.tokens.rotate(refreshToken, meta);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  async me(userId: string): Promise<PublicUser & { hasSpace: boolean }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { memberships: { select: { spaceId: true } } },
    });
    return { ...toPublicUser(user), hasSpace: user.memberships.length > 0 };
  }
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
  };
}
