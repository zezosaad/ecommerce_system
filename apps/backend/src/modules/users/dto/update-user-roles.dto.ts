import { IsArray, ValidateNested, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class RoleAssignmentDto {
  @IsString()
  roleKey!: string;

  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsString()
  storeId?: string;
}

export class UpdateUserRolesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleAssignmentDto)
  assignments!: RoleAssignmentDto[];
}
