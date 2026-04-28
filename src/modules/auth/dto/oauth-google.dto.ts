import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OAuthGoogleDto {
  @ApiProperty({ description: 'Google ID token from client-side OAuth' })
  @IsString()
  idToken: string;
}
