import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Tracks per-user API usage counters that Plaspy returns in every response
 * envelope (apiUsage / apiDailyUsage). Daily counter resets at UTC midnight.
 */
@Injectable()
export class ApiUsageService {
  private readonly logger = new Logger(ApiUsageService.name);
  private readonly counters = new Map<string, { total: number; daily: number; day: string }>();

  constructor(private readonly prisma: PrismaService) {}

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Records one API call for the user and returns updated counters.
   */
  async recordAndGet(userId: string): Promise<{ apiUsage: number; apiDailyUsage: number }> {
    const today = this.today();
    let entry = this.counters.get(userId);
    if (!entry) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { apiDailyUsage: true, apiUsageDate: true },
      });
      const storedDay = user?.apiUsageDate ? user.apiUsageDate.toISOString().slice(0, 10) : null;
      const storedDaily = storedDay === today ? user?.apiDailyUsage ?? 0 : 0;
      entry = { total: 0, daily: storedDaily, day: today };
    }
    if (entry.day !== today) {
      entry = { total: entry.total, daily: 0, day: today };
    }
    entry.total += 1;
    entry.daily += 1;
    this.counters.set(userId, entry);

    // persist asynchronously (fire and forget); failures only log
    void this.prisma.user
      .update({
        where: { id: userId },
        data: { apiDailyUsage: entry.daily, apiUsageDate: new Date() },
      })
      .catch(() => undefined);

    return { apiUsage: entry.total, apiDailyUsage: entry.daily };
  }
}
