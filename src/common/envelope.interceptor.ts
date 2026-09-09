import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { ApiUsageService } from './api-usage.service';

export interface EnvelopeMeta {
  success: true;
  apiUsage?: number;
  apiDailyUsage?: number;
  error?: null;
}

/**
 * Wraps controller return values in the Plaspy response envelope:
 * { success, error, apiUsage, apiDailyUsage, ...payload }
 */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly apiUsage: ApiUsageService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.id;

    return next.handle().pipe(
      map(async (payload) => {
        const envelope: Record<string, unknown> = {
          success: true,
          error: null,
        };
        if (userId) {
          const usage = await this.apiUsage.recordAndGet(userId);
          envelope.apiUsage = usage.apiUsage;
          envelope.apiDailyUsage = usage.apiDailyUsage;
        }
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          Object.assign(envelope, payload);
        } else if (payload !== undefined) {
          envelope.result = payload;
        }
        return envelope;
      }),
    );
  }
}
