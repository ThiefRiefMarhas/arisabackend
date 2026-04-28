# ARISA Cloud Backend — Observability

> **Dokumen ini menjelaskan strategi logging, monitoring, health check, dan tracing.**

---

## 1. Observability Stack

| Layer | Tool | Fungsi |
|-------|------|--------|
| **Structured Logging** | Winston (NestJS) | Log JSON ke console + file |
| **Request Tracing** | RequestIdMiddleware | Correlation ID per request |
| **Request Logging** | LoggingInterceptor | Log setiap request/response |
| **Health Check** | HealthModule | Liveness + readiness probes |
| **Queue Monitoring** | BullMQ Dashboard (Bull Board) | Visualisasi sync queue |
| **Audit Trail** | AuditModule | Log aksi sensitif ke database |

> **Catatan**: Untuk Fase 1-3, stack di atas sudah cukup. Prometheus + Grafana bisa ditambahkan di Fase 4+ jika diperlukan.

---

## 2. Structured Logging

### 2.1 Logger Setup (Winston)

```typescript
// main.ts
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

const app = await NestFactory.create(AppModule, {
  logger: WinstonModule.createLogger({
    transports: [
      // Console (pretty untuk dev, JSON untuk prod)
      new winston.transports.Console({
        format: process.env.NODE_ENV === 'production'
          ? winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            )
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.timestamp({ format: 'HH:mm:ss' }),
              winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
                return `${timestamp} [${context || 'App'}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
              }),
            ),
      }),
      // File (production only)
      ...(process.env.NODE_ENV === 'production' ? [
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      ] : []),
    ],
  }),
});
```

### 2.2 Log Levels

| Level | Kapan Dipakai | Contoh |
|-------|---------------|--------|
| `error` | Error yang harus diinvestigasi | DB connection failed, sync worker crash |
| `warn` | Anomali yang tidak fatal | Rate limit hit, slow query, stale token attempt |
| `info` | Event penting normal | User login, device paired, sync completed |
| `debug` | Detail untuk development | Query params, payload content, flow tracing |

### 2.3 Log Format (Production JSON)

```json
{
  "level": "info",
  "timestamp": "2026-04-20T10:00:00.000Z",
  "context": "SyncService",
  "message": "Sync job processed successfully",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "jobId": "abc-123",
  "deviceId": "dev-001",
  "userId": "usr-001",
  "durationMs": 45,
  "payloadType": "scan_result"
}
```

---

## 3. Request ID Middleware

```typescript
// common/middleware/request-id.middleware.ts

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Client bisa kirim request ID sendiri, atau auto-generate
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    
    // Attach ke request untuk dipakai downstream
    req['requestId'] = requestId;
    
    // Kirim balik di response header
    res.setHeader('X-Request-Id', requestId);
    
    next();
  }
}
```

Registrasi di AppModule:

```typescript
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
```

---

## 4. Request/Response Logging Interceptor

```typescript
// common/interceptors/logging.interceptor.ts

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body } = request;
    const requestId = request['requestId'];
    const userId = request.user?.id || 'anonymous';
    const deviceId = request.device?.id || null;
    const startTime = Date.now();

    return next.handle().pipe(
      tap((responseBody) => {
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode;
        const durationMs = Date.now() - startTime;

        this.logger.log({
          message: `${method} ${url} ${statusCode}`,
          requestId,
          method,
          url,
          statusCode,
          durationMs,
          userId,
          deviceId,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
        });
      }),
      catchError((error) => {
        const durationMs = Date.now() - startTime;
        this.logger.error({
          message: `${method} ${url} ${error.status || 500}`,
          requestId,
          method,
          url,
          statusCode: error.status || 500,
          durationMs,
          userId,
          deviceId,
          error: error.message,
        });
        throw error;
      }),
    );
  }
}
```

---

## 5. Health Check

### 5.1 Health Controller

```typescript
// modules/health/health.controller.ts

@Controller()  // Tidak pakai global prefix!
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private supabase: SupabaseService,
  ) {}

  @Get('health')
  async health() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready() {
    const checks: Record<string, any> = {};

    // Check database
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'ok', responseTimeMs: Date.now() - start };
    } catch (e) {
      checks.database = { status: 'error', error: e.message };
    }

    // Check Redis
    try {
      const start = Date.now();
      await this.redis.ping();
      checks.redis = { status: 'ok', responseTimeMs: Date.now() - start };
    } catch (e) {
      checks.redis = { status: 'error', error: e.message };
    }

    // Check Supabase
    try {
      const client = this.supabase.getClient();
      checks.supabase = { status: client ? 'ok' : 'not_configured' };
    } catch (e) {
      checks.supabase = { status: 'error', error: e.message };
    }

    const allOk = Object.values(checks).every((c: any) => c.status === 'ok');
    const status = allOk ? 'ok' : 'degraded';

    if (!allOk) {
      throw new ServiceUnavailableException({ status, checks });
    }

    return { status, checks };
  }
}
```

### 5.2 Health Check di Docker

```yaml
# docker-compose.yml
services:
  api:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

---

## 6. Audit Logging

### 6.1 Audit Service

```typescript
// modules/audit/audit.service.ts

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    actorType: 'user' | 'device' | 'system';
    actorId: string;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorType: params.actorType,
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: params.metadata || {},
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }
}
```

### 6.2 Event Types yang Harus Di-audit

| Category | Action | Trigger |
|----------|--------|---------|
| **Auth** | `auth.register` | User register |
| **Auth** | `auth.login` | User login |
| **Auth** | `auth.login_failed` | Login gagal |
| **Auth** | `auth.logout` | User logout |
| **Auth** | `auth.revoke_all` | Revoke all sessions |
| **Device** | `device.register` | Device register baru |
| **Device** | `device.pair` | Device di-pair ke user |
| **Device** | `device.revoke` | Device di-revoke |
| **Device** | `device.disable` | Admin disable device |
| **Sync** | `sync.push` | Data sync masuk |
| **Sync** | `sync.conflict` | Conflict terdeteksi |
| **Sync** | `sync.failed_permanent` | Job gagal permanent (DLQ) |
| **Data** | `data.create` | Record baru dibuat |
| **Data** | `data.update` | Record diubah |
| **Data** | `data.delete` | Record dihapus |
| **Admin** | `admin.user_suspend` | Admin suspend user |
| **Admin** | `admin.device_disable` | Admin disable device |
| **AI** | `ai.request` | AI analysis request |

---

## 7. Queue Monitoring (Bull Board)

### Setup

```typescript
// app.module.ts
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';

@Module({
  imports: [
    BullBoardModule.forRoot({
      route: '/admin/queues',  // Protected by admin auth
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'sync-queue',
      adapter: BullMQAdapter,
    }),
  ],
})
```

### Dashboard menampilkan:
- Queue depth (pending, active, completed, failed, delayed)
- Job processing rate
- Failed jobs dengan error message
- Retry history per job
- Dead letter queue content

---

## 8. Key Metrics to Track

### Application Metrics

| Metric | Sumber | Baseline | Alert |
|--------|--------|----------|-------|
| Response time p50 | LoggingInterceptor | < 100ms | > 500ms |
| Response time p95 | LoggingInterceptor | < 300ms | > 1s |
| Response time p99 | LoggingInterceptor | < 500ms | > 2s |
| Error rate (5xx) | ExceptionFilter | < 1% | > 5% |
| Request rate | LoggingInterceptor | varies | sudden spike |

### Sync Metrics

| Metric | Sumber | Alert |
|--------|--------|-------|
| Queue depth | BullMQ | > 500 pending |
| Processing rate | SyncProcessor | < 10 jobs/min |
| Failure rate | SyncProcessor | > 10% |
| DLQ count | BullMQ | > 0 |
| Average processing time | SyncProcessor | > 5s |

### Device Metrics

| Metric | Sumber | Alert |
|--------|--------|-------|
| Active devices | Heartbeat | sudden drop |
| Device offline > 1h | LastSeenAt check | per device |
| Heartbeat failures | API logs | > 3 consecutive |

### Database Metrics

| Metric | Sumber | Alert |
|--------|--------|-------|
| Connection pool usage | Prisma | > 80% |
| Slow queries (> 1s) | Prisma logging | any occurrence |
| Table size growth | pg_stat | unusual spike |
