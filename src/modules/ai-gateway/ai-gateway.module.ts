import { Module } from '@nestjs/common';
import { AiGatewayController } from './ai-gateway.controller';
import { AiGatewayService } from './ai-gateway.service';
import { OpenRouterClient } from './openrouter.client';

@Module({
  controllers: [AiGatewayController],
  providers: [AiGatewayService, OpenRouterClient],
  exports: [AiGatewayService],
})
export class AiGatewayModule {}
