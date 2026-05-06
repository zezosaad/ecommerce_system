import { Injectable } from '@nestjs/common';
import { TemplateRepository } from './template.repository';
import { TenantContext } from '../common/tenant/tenant-aware.repository';

@Injectable()
export class TemplateService {
  constructor(private repository: TemplateRepository) {}

  async list(context: TenantContext): Promise<unknown[]> {
    return this.repository.list(context);
  }
}
