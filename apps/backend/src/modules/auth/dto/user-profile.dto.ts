import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  phone: string | null = null;

  @ApiPropertyOptional()
  firstName: string | null = null;

  @ApiPropertyOptional()
  lastName: string | null = null;

  @ApiPropertyOptional()
  avatarUrl: string | null = null;

  @ApiProperty()
  preferredLanguage!: string;

  @ApiProperty()
  defaultCurrency!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
