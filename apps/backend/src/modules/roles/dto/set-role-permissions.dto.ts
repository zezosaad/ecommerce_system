import { IsArray, IsString } from 'class-validator';

export class SetRolePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}
