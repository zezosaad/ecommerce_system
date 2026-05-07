import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsUrl, IsEnum } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ required: false, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiProperty({ required: false, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiProperty({ required: false, format: 'uri' })
  @IsOptional()
  @IsString()
  @IsUrl()
  avatarUrl?: string | null;

  @ApiProperty({ required: false, enum: ['en', 'ar'] })
  @IsOptional()
  @IsEnum(['en', 'ar'])
  preferredLanguage?: 'en' | 'ar';

  @ApiProperty({ required: false, minLength: 3, maxLength: 3 })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  @MaxLength(3)
  defaultCurrency?: string;

  @ApiProperty({ required: false, description: 'E.164 format or null' })
  @IsOptional()
  @IsString()
  phone?: string | null;
}
