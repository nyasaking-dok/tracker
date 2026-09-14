import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async issueToken(userName: string, apiKey: string) {
    const user = await this.prisma.user.findUnique({ where: { userName } });
    if (!user) throw new UnauthorizedException('Invalid API key or username.');

    const ok = await bcrypt.compare(apiKey, user.apiKey);
    if (!ok) throw new UnauthorizedException('Invalid API key or username.');
    if (user.disabled) {
      throw new UnauthorizedException(user.disabledMessage || 'User is disabled.');
    }
    if (user.expires && user.expires < new Date()) {
      throw new UnauthorizedException('User account has expired.');
    }

    const payload = { sub: user.id, userName: user.userName };
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') || '24h';
    const token = await this.jwt.signAsync(payload, { expiresIn } as any);
    const expires = new Date();
    expires.setTime(expires.getTime() + this.parseDuration(expiresIn));

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    return { token, expires: expires.toISOString() };
  }

  private parseDuration(d: string): number {
    const m = /^(\d+)(h|m|s|d)?$/.exec(d.trim());
    if (!m) return 24 * 3600 * 1000;
    const n = parseInt(m[1], 10);
    switch (m[2]) {
      case 'd':
        return n * 24 * 3600 * 1000;
      case 'm':
        return n * 60 * 1000;
      case 's':
        return n * 1000;
      default:
        return n * 3600 * 1000;
    }
  }
}
