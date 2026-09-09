import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Renders ALL errors in the Plaspy envelope shape:
 * { success: false, error: "...", apiUsage?: n, apiDailyUsage?: n }
 * with HTTP status preserved.
 */
@Catch()
export class PlaspyExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PlaspyExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        // use validation details if present, else the message
        if (typeof b.message === 'string') {
          message = b.message;
        } else if (Array.isArray(b.message)) {
          message = b.message.join('; ');
        } else if (typeof b.error === 'string') {
          message = b.error;
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error on ${request.method} ${request.url}`, exception.stack);
      message = 'Internal Server Error';
    }

    const body: Record<string, unknown> = {
      success: false,
      error: message,
    };
    const userId = request?.user?.id;
    if (userId) {
      // counters are recorded by the interceptor on success paths only;
      // for errors we still include the current values via request attach
      const usage = request.apiUsageSnapshot as
        | { apiUsage: number; apiDailyUsage: number }
        | undefined;
      if (usage) {
        body.apiUsage = usage.apiUsage;
        body.apiDailyUsage = usage.apiDailyUsage;
      }
    }

    response.status(status).json(body);
  }
}
