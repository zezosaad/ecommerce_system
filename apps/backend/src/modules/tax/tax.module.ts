import { Module } from '@nestjs/common';
import { TaxClassesController, CountryTaxRulesController } from './tax.controller';

@Module({
  controllers: [TaxClassesController, CountryTaxRulesController],
})
export class TaxModule {}
