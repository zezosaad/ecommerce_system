import { ApiPropertyOptional } from '@nestjs/swagger';

export class AccessScopeDto {
  @ApiPropertyOptional()
  scopeType!: string;

  @ApiPropertyOptional()
  merchantId: string | null = null;

  @ApiPropertyOptional()
  storeId: string | null = null;
}
