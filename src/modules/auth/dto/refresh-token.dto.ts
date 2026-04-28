import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Supabase refresh token' })
  @IsString()
  refreshToken: string;
}
