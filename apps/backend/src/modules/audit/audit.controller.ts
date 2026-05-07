import {
  Controller,
  Get,
  Query,
  Param,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { StoreScope } from '../auth/store-scope.guard';
import { AuditService } from './audit.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { SuccessEnvelope, ListEnvelope } from '../common/envelopes';
import { buildMetaFromRequest } from '../common/envelopes/meta';
import { Request } from 'express';

@ApiTags('AuditLogs')
@ApiBearerAuth()
@Controller('api/v1/audit-logs')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @Permissions('audit_logs.entries.view')
  @StoreScope({ param: 'merchantId', source: 'query' })
  @ApiOperation({ summary: 'List audit logs (cursor-paginated, filterable)' })
  @ApiQuery({ name: 'merchantId', required: false, type: String })
  @ApiQuery({ name: 'storeId', required: false, type: String })
  async list(
    @Query() query: ListAuditLogsDto,
    @Req() req: Request,
  ) {
    const pageSize = query.page_size ?? 20;
    const meta = buildMetaFromRequest(req);

    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    // FR-023/FR-026: Super Admin sees everything; everyone else is restricted
    // to merchants they have access scope for, plus their own actor rows.
    const ctx = req.authContext;
    const isSuperAdmin =
      ctx?.roles.some((r) => r.code === 'super_admin') ?? false;
    let allowedMerchantIds: string[] | null = null;
    if (!isSuperAdmin && ctx) {
      allowedMerchantIds = Array.from(
        new Set(
          ctx.accessScopes
            .map((s) => s.merchantId)
            .filter((id): id is string => !!id),
        ),
      );
    }

    const result = await this.auditService.list({
      cursor: query.cursor,
      pageSize,
      actorUserId: query.actorUserId ?? (isSuperAdmin ? undefined : ctx?.userId),
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      merchantId: query.merchantId,
      storeId: query.storeId,
      from,
      to,
      severity: query.severity,
      allowedMerchantIds: isSuperAdmin ? null : allowedMerchantIds,
    });

    return new ListEnvelope(result.items, result.items.length, 1, pageSize, meta);
  }

  @Get(':id')
  @Permissions('audit_logs.entries.view')
  @ApiOperation({ summary: 'Get a single audit log entry' })
  async getOne(@Param('id') id: string, @Req() req: Request) {
    const meta = buildMetaFromRequest(req);
    const item = await this.auditService.getById(id);

    if (!item) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Audit log not found',
      });
    }

    // FR-023/FR-026: enforce per-tenant visibility on detail reads.
    const ctx = req.authContext;
    const isSuperAdmin =
      ctx?.roles.some((r) => r.code === 'super_admin') ?? false;
    if (!isSuperAdmin) {
      const allowedMerchantIds = new Set(
        (ctx?.accessScopes ?? [])
          .map((s) => s.merchantId)
          .filter((m): m is string => !!m),
      );
      const rowMerchantId = (item as { merchantId?: string | null }).merchantId;
      const isOwnRow = (item as { actorUserId?: string }).actorUserId === ctx?.userId;
      const merchantOk = rowMerchantId && allowedMerchantIds.has(rowMerchantId);
      if (!isOwnRow && !merchantOk) {
        throw new NotFoundException({
          code: 'RESOURCE_NOT_FOUND',
          message: 'Audit log not found',
        });
      }
    }

    return new SuccessEnvelope(item, meta);
  }
}
