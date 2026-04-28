import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PairConfirmDto {
  @ApiProperty({ example: 'A7X9K2', description: '6-char pairing code' })
  @IsString()
  pairingCode: string;

  @ApiProperty({ description: 'Device UUID to pair with' })
  @IsString()
  deviceId: string;
}
