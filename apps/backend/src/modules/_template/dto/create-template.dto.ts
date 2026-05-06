import { IsString, IsOptional } from 'class-validator';
import { IsTranslatable } from '../../common/i18n/translatable';

export class CreateTemplateDto {
  @IsString()
  code!: string;

  @IsTranslatable()
  name!: { ar: string; en: string };

  @IsOptional()
  @IsTranslatable()
  description?: { ar: string; en: string };
}
