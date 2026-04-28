import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PairStartDto {
  @ApiProperty({ description: 'Device UUID to generate pairing code for' })
  @IsString()
  deviceId: string;
}
