import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates a userName/apiKey pair (Plaspy /api/Auth/Token credentials).
   * Returns the user when valid, throws Unauthorized otherwise.
   */
  async validateApiKey(userName: string, apiKey: string) {
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
    return user;
  }

  newApiKey(): string {
    return `pk_${randomBytes(24).toString('hex')}`;
  }
}
