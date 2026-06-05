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
      message: 'Welcome to ARISA Backend API',
      data: {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        documentation: '/api/docs',
        status: 'Operational',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}
