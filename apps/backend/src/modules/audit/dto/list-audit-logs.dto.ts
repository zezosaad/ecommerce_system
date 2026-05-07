import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsDateString, IsEnum } from 'class-validator';
import { PaginationDto } from '../../common/dto';

export enum AuditSeverity {
  info = 'info',
  notice = 'notice',
  warning = 'warning',
  critical = 'critical',
}

export class ListAuditLogsDto extends PaginationDto {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  merchantId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: AuditSeverity })
  @IsOptional()
  @IsEnum(AuditSeverity)
  severity?: AuditSeverity;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  cursor?: string;
}
