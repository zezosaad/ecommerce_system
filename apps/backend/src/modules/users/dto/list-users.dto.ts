import { IsOptional, IsString, IsIn } from 'class-validator';
import { PaginationDto } from '../../common/dto';
import { UserStatus } from '@vendorhub/types';

export class ListUsersDto extends PaginationDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['active', 'inactive', 'suspended', 'pending_verification', 'deleted'])
  status?: UserStatus;

  @IsOptional()
  @IsString()
  roleKey?: string;

  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsString()
  storeId?: string;
}
