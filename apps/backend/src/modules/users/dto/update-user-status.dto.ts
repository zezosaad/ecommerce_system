import { IsIn, IsOptional, IsString } from 'class-validator';
import type { UserStatus } from '@vendorhub/types';

const SETTABLE_STATUSES: UserStatus[] = [
  'active',
  'inactive',
  'suspended',
  'deleted',
];

export class UpdateUserStatusDto {
  @IsIn(SETTABLE_STATUSES)
  status!: Exclude<UserStatus, 'pending_verification'>;

  @IsOptional()
  @IsString()
  reason?: string;
}
