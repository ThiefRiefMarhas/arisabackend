import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';

// Global filters & interceptors
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Body Parser Limits ──────────────────────────────────────
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // ── Security ────────────────────────────────────────────────
  app.use(helmet());

  // ── CORS ────────────────────────────────────────────────────
  // Mobile apps (Flutter) don't send Origin headers like browsers,
  // so we allow all origins. Swagger docs also need this.
  app.enableCors({
    origin: true, // Allow all origins (mobile app + Swagger)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // ── Global Prefix ───────────────────────────────────────────
  // Exclude health endpoints from prefix (they must be at root)
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
    ],
  });

  // ── Validation ──────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── Global Filters & Interceptors ──────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // ── Swagger ─────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('ARISA Cloud Backend API')
    .setDescription(
      'Cloud backend API for the ARISA hybrid IoT agricultural system. ' +
      'Provides authentication, device management, data sync, AI gateway, ' +
      'and monitoring capabilities.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase JWT access token for user authentication',
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-Device-Token',
        description: 'Device authentication token for Raspberry Pi',
      },
      'device-token',
    )
    .addTag('Health', 'System health and readiness checks')
    .addTag('Auth', 'User authentication and session management')
    .addTag('Users', 'User profile management')
    .addTag('Devices', 'Device registration, pairing, and management')
    .addTag('Sync', 'Data synchronization between edge and cloud')
    .addTag('Data', 'Core data CRUD operations')
    .addTag('Telemetry', 'Device telemetry data')
    .addTag('AI', 'AI gateway for analysis and chat')
    .addTag('Notifications', 'In-app notification management')
    .addTag('Admin', 'Admin dashboard and management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // ── Start ───────────────────────────────────────────────────
  const port = parseInt(process.env.PORT || '8080', 10);
  
  try {
    // Cloud Run requires listening on 0.0.0.0 (all interfaces)
    await app.listen(port, '0.0.0.0');
    console.log(`\n🚀 ARISA Cloud Backend running on port ${port}`);
    console.log(`📚 Swagger docs: http://0.0.0.0:${port}/api/docs`);
    console.log(`❤️  Health check: http://0.0.0.0:${port}/health\n`);
  } catch (error) {
    console.error('Failed to start application', error);
    process.exit(1);
  }
}

bootstrap();
