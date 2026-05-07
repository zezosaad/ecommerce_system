import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { LocalizedDto } from './localized.dto';

export class RoleDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  key!: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => LocalizedDto)
  label!: LocalizedDto;

  @ApiPropertyOptional()
  @ValidateNested()
  @Type(() => LocalizedDto)
  description?: LocalizedDto | null;

  @ApiProperty()
  isSystem!: boolean;
}
