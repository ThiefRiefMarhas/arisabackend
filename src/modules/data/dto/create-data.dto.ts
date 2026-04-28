import { IsString, IsOptional, IsObject, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDataDto {
  @ApiProperty({ example: 'scan_result', description: 'Type of data record' })
  @IsString()
  dataType: string;

  @ApiProperty({ description: 'The actual data payload (JSON)' })
  @IsObject()
  dataJson: Record<string, any>;

  @ApiPropertyOptional({ description: 'Associated device ID' })
  @IsOptional()
  @IsUUID()
  deviceId?: string;
}
