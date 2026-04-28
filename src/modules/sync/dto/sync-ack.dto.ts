import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SyncAckDto {
  @ApiProperty({
    type: [String],
    description: 'Job IDs to acknowledge as synced',
  })
  @IsArray()
  @IsString({ each: true })
  jobIds: string[];
}
