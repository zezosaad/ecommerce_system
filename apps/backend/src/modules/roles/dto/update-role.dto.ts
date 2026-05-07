import { IsOptional, ValidateNested, IsArray, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { Localized } from '@vendorhub/types';

export class UpdateRoleDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  label?: Localized;

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  description?: Localized | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}
