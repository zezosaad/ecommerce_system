import { IsString, IsIn, IsObject, IsUUID, IsEmail, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SupabaseEventRecordDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ format: 'email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  email_confirmed_at?: string | null;
}

export class PostSupabaseAuthWebhookDto {
  @ApiProperty({ description: 'Provider event id' })
  @IsString()
  id!: string;

  @ApiProperty({ enum: ['user.created', 'user.email_confirmed', 'user.deleted'] })
  @IsIn(['user.created', 'user.email_confirmed', 'user.deleted'])
  type!: 'user.created' | 'user.email_confirmed' | 'user.deleted';

  @ApiProperty({ type: SupabaseEventRecordDto })
  @IsObject()
  record!: SupabaseEventRecordDto;
}
