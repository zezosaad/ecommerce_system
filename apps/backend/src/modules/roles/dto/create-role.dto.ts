import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Localized } from '@vendorhub/types';

export class CreateRoleDto {
  @IsString()
  key!: string;

  @ValidateNested()
  @Type(() => Object)
  label!: Localized;

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  description?: Localized | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}
