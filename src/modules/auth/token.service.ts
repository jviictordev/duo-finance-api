import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';

export interface AccessPayload {
  sub: string;
  email: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {}

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private parseTtlToDate(ttl: string): Date {
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) throw new Error(`TTL inválido: ${ttl}`);
    const value = Number(match[1]);
    const unitMs = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[
      match[2] as 's' | 'm' | 'h' | 'd'
    ];
    return new Date(Date.now() + value * unitMs);
  }

  async issueForUser(
    user: { id: string; email: string },
    meta: SessionMeta = {},
    familyId: string = randomUUID(),
  ): Promise<IssuedTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email } satisfies AccessPayload,
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
      },
    );

    const refreshRaw = randomBytes(48).toString('base64url');
    const refreshTtl = this.config.get('JWT_REFRESH_TTL', { infer: true });
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hash(refreshRaw),
        familyId,
        expiresAt: this.parseTtlToDate(refreshTtl),
        userAgent: meta.userAgent,
        ip: meta.ip,
      },
    });

    return {
      accessToken,
      refreshToken: refreshRaw,
      expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
    };
  }

  async verifyAccess(token: string): Promise<AccessPayload> {
    try {
      return await this.jwt.verifyAsync<AccessPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Token de acesso inválido ou expirado.');
    }
  }

  /**
   * Rotação com detecção de reuso: se o refresh token apresentado já foi usado
   * (revokedAt != null), toda a família é revogada — sessão comprometida.
   */
  async rotate(
    refreshRaw: string,
    meta: SessionMeta = {},
  ): Promise<IssuedTokens> {
    const tokenHash = this.hash(refreshRaw);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token desconhecido.');
    }

    if (stored.revokedAt || stored.expiresAt < new Date()) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        'Refresh token reutilizado ou expirado. Sessão encerrada.',
      );
    }

    const next = await this.issueForUser(
      { id: stored.user.id, email: stored.user.email },
      meta,
      stored.familyId,
    );

    const nextHash = this.hash(next.refreshToken);
    const replacement = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: nextHash },
      select: { id: true },
    });
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedBy: replacement?.id ?? null },
    });

    return next;
  }

  async revoke(refreshRaw: string): Promise<void> {
    const tokenHash = this.hash(refreshRaw);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { familyId: true },
    });
    if (!stored) return;
    await this.prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Token curto usado só para abrir o stream SSE (EventSource não manda header). */
  async issueStreamToken(userId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, scope: 'stream' },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('STREAM_TOKEN_TTL', { infer: true }),
      },
    );
  }

  async verifyStreamToken(token: string): Promise<{ sub: string }> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; scope: string }>(
        token,
        { secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }) },
      );
      if (payload.scope !== 'stream') throw new Error('escopo inválido');
      return { sub: payload.sub };
    } catch {
      throw new UnauthorizedException('Stream token inválido.');
    }
  }
}
