import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class SyncProfileDto {
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

  @ApiProperty({ required: false, enum: ['en', 'ar'] })
  @IsOptional()
  @IsString()
  preferredLanguage?: 'en' | 'ar';

  @ApiProperty({ required: false, description: 'E.164 format' })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'Phone must be in E.164 format' })
  phone?: string;
}
