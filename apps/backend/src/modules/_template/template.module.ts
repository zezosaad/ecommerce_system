import { Module } from '@nestjs/common';
import { ExampleController } from './template.controller';
import { TemplateService } from './template.service';
import { TemplateRepository } from './template.repository';

@Module({
  controllers: [ExampleController],
  providers: [TemplateService, TemplateRepository],
})
export class TemplateModule {}
