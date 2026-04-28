import { IsArray, ValidateNested, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { SyncPushDto } from './sync-push.dto';

export class SyncBatchDto {
  @ApiProperty({ type: [SyncPushDto], description: 'Batch items (max 100)' })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SyncPushDto)
  items: SyncPushDto[];
}
