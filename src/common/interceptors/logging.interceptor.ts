import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';

/**
 * Logs every incoming request and outgoing response with timing.
 * Production: JSON format. Development: colored console.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, ip } = request;
    const req = request as any;
    const requestId = req.requestId || '-';
    const userId = req.user?.id || 'anonymous';
    const deviceId = req.device?.id || null;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode;
        const durationMs = Date.now() - startTime;

        this.logger.log(
          `${method} ${url} ${statusCode} ${durationMs}ms` +
            ` [req:${requestId}] [user:${userId}]` +
            (deviceId ? ` [device:${deviceId}]` : ''),
        );
      }),
      catchError((error) => {
        const durationMs = Date.now() - startTime;
        const statusCode = error.status || 500;

        this.logger.error(
          `${method} ${url} ${statusCode} ${durationMs}ms` +
            ` [req:${requestId}] [user:${userId}]` +
            (deviceId ? ` [device:${deviceId}]` : '') +
            ` — ${error.message}`,
        );

        return throwError(() => error);
      }),
    );
  }
}
