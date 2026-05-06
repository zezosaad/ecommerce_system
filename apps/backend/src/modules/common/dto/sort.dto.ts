import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SortDto {
  @ApiPropertyOptional({
    description: 'Sort field with optional leading "-" for descending. e.g. "-updated_at"',
    default: 'created_at',
  })
  @IsOptional()
  @IsString()
  sort?: string = 'created_at';
}
