import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested, IsArray, IsBoolean } from 'class-validator';
import { UserProfileDto } from './user-profile.dto';
import { RoleDto } from './role.dto';
import { AccessScopeDto } from './access-scope.dto';

export class AuthEnvelopeDto {
  @ApiProperty()
  user!: UserProfileDto;

  @ApiProperty({ type: [RoleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleDto)
  roles!: RoleDto[];

  @ApiProperty({ type: [String] })
  @IsArray()
  permissions!: string[];

  @ApiProperty({ type: [AccessScopeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccessScopeDto)
  accessScopes!: AccessScopeDto[];

  @ApiProperty()
  @IsBoolean()
  isSuperAdmin!: boolean;
}
