import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';

// Config
import configuration from './common/config/configuration';
import { envValidationSchema } from './common/config/env.validation';

// Global modules
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SupabaseModule } from './supabase/supabase.module';

// Feature modules
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { DeviceModule } from './modules/device/device.module';
import { SyncModule } from './modules/sync/sync.module';
import { DataModule } from './modules/data/data.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AiGatewayModule } from './modules/ai-gateway/ai-gateway.module';
import { AdminModule } from './modules/admin/admin.module';
import { WeatherModule } from './modules/weather/weather.module';

// Middleware
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

@Module({
  imports: [
    // Configuration — loaded first, globally available
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false, // Show all missing env vars at once
      },
    }),

    // Global infrastructure modules
    PrismaModule,
    RedisModule,
    SupabaseModule,

    // Feature modules
    HealthModule,
    AuthModule,
    UserModule,
    DeviceModule,
    SyncModule,
    DataModule,
    TelemetryModule,
    AuditModule,
    NotificationModule,
    AiGatewayModule,
    AdminModule,
    WeatherModule,
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
