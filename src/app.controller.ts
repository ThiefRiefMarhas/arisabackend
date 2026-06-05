import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Root')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Welcome to ARISA API' })
  getHello() {
    return {
      success: true,
      message: 'Welcome to ARISA Cloud API (Agricultural Real-time Intelligent System Assistant)',
      data: {
        system: {
          name: 'ARISA Backend Infrastructure',
          project: 'Olimpiade Penelitian Siswa Indonesia (OPSI) 2026',
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'production',
          status: 'Operational',
        },
        services: {
          authentication: 'Supabase JWT & Edge Device Tokens',
          database: 'PostgreSQL with Prisma ORM',
          synchronization: 'IoT Edge-to-Cloud Real-time Sync',
          artificial_intelligence: 'OpenRouter AI Gateway (Gemini/Claude)',
          telemetry: 'Device Monitoring & Diagnostics',
          notifications: 'Push Notification Subsystem',
        },
        client_interfaces: {
          mobile_application: 'Flutter Cross-Platform Application Active',
          edge_devices: 'Raspberry Pi Sync Gateway Active',
        },
        links: {
          documentation: '/api/docs',
          health_check: '/health',
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        maintainer: 'ARISA Core Development Team',
      },
    };
  }
}
