import {
  Controller,
  Get,
  Query,
  Param,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Audit } from '../audit/decorators/audit.decorator';
import { SuccessEnvelope, ListEnvelope } from '../common/envelopes';
import { buildMetaFromRequest } from '../common/envelopes/meta';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto';
import { ErrorCode } from '../common/errors/error-codes';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Permissions('platform.settings.read')
  @Audit({ action: 'platform.settings.read', severity: 'info' })
  @ApiOperation({ summary: 'List settings (scoped to caller)' })
  async list(
    @Query() pagination: PaginationDto,
    @Query('scope') scope?: 'global' | 'merchant',
    @Req() req?: Request,
  ) {
    const page = pagination.page ?? 1;
    const pageSize = pagination.page_size ?? 20;
    const meta = buildMetaFromRequest(req!);

    const where: Record<string, unknown> = { deletedAt: null };
    if (scope === 'global') {
      where.merchantId = null;
    } else if (scope === 'merchant') {
      where.merchantId = { not: null };
    }

    const [settings, total] = await Promise.all([
      this.prisma.setting.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { key: 'asc' },
      }),
      this.prisma.setting.count({ where }),
    ]);

    const data = settings.map((s: (typeof settings)[number]) => ({
      id: s.id,
      key: s.key,
      scope: s.merchantId ? 'merchant' : 'global',
      merchant_id: s.merchantId,
      value: s.isSecret ? '[REDACTED]' : s.value,
      is_secret: s.isSecret,
      description: s.description,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
    }));

    return new ListEnvelope(data, total, page, pageSize, meta);
  }

  @Get(':key')
  @Permissions('platform.settings.read')
  @Audit({ action: 'platform.settings.read', severity: 'info' })
  @ApiOperation({ summary: 'Read a single setting' })
  async getOne(@Param('key') key: string, @Req() req: Request) {
    const meta = buildMetaFromRequest(req);

    const setting = await this.prisma.setting.findFirst({
      where: { key, deletedAt: null },
    });

    if (!setting) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: `Setting "${key}" not found.`,
      });
    }

    return new SuccessEnvelope(
      {
        id: setting.id,
        key: setting.key,
        scope: setting.merchantId ? 'merchant' : 'global',
        merchant_id: setting.merchantId,
        value: setting.isSecret ? '[REDACTED]' : setting.value,
        is_secret: setting.isSecret,
        description: setting.description,
        created_at: setting.createdAt,
        updated_at: setting.updatedAt,
      },
      meta,
    );
  }
}
