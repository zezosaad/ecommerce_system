import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FilterDto {
  @ApiPropertyOptional({ description: 'Filter by a specific field value' })
  @IsOptional()
  @IsString()
  field?: string;

  @ApiPropertyOptional({ description: 'Value to filter by' })
  @IsOptional()
  @IsString()
  value?: string;
}
