import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantAwareRepository, TenantContext } from '../common/tenant/tenant-aware.repository';

@Injectable()
export class TemplateRepository extends TenantAwareRepository {
  constructor(private prisma: PrismaService) {
    super();
  }

  async list(context: TenantContext): Promise<unknown[]> {
    this.ensureTenantScope(context, false, false);
    return [];
  }
}
