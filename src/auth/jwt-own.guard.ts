import { ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * JWT guard that also enforces data ownership:
 * - a master sees its own data plus all sub-users' data
 * - a sub-user sees only its own data
 */
@Injectable()
export class JwtOwnGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>([IS_PUBLIC], [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const result = (await super.canActivate(context)) as boolean;
    if (!result) return false;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) throw new UnauthorizedException('Invalid token.');

    // compute allowed owner ids once per request
    const ownerIds = new Set<string>([user.id]);
    const subs = await this.prisma.user.findMany({
      where: { masterId: user.id },
      select: { id: true },
    });
    for (const s of subs) ownerIds.add(s.id);
    request.ownerIds = ownerIds;
    request.isMaster = subs.length > 0 || user.masterId === null;
    return true;
  }
}
