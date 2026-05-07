import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LocalizedDto {
  @ApiProperty()
  @IsString()
  en!: string;

  @ApiProperty()
  @IsString()
  ar!: string;
}
