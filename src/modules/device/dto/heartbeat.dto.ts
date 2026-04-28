import { IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class HeartbeatDto {
  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  firmwareVersion?: string;

  @ApiPropertyOptional({ example: 'online' })
  @IsOptional()
  networkStatus?: string;
}
