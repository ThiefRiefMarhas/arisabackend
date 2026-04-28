import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SupabaseService } from '../../supabase/supabase.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly supabase: SupabaseService,
  ) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe — basic health check' })
  async health() {
    return {
      __raw: true, // Skip transform interceptor wrapping
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Readiness probe — checks all dependencies',
  })
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

    // Only database is a hard dependency — Redis is optional (in-memory fallback)
    const criticalOk = checks.database?.status === 'ok';
    const allOk = Object.values(checks).every(
      (c: any) => c.status === 'ok' || c.status === 'not_configured',
    );

    const result = {
      __raw: true, // Skip transform interceptor wrapping
      status: criticalOk ? (allOk ? 'ok' : 'degraded') : 'unhealthy',
      checks,
      timestamp: new Date().toISOString(),
    };

    if (!criticalOk) {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
