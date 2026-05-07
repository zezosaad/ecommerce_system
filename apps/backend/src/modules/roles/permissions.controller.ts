import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsService } from './permissions.service';
import { SuccessEnvelope, ListEnvelope } from '../common/envelopes';
import { buildMetaFromRequest } from '../common/envelopes/meta';
import { PaginationDto } from '../common/dto';

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('api/v1/permissions')
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  @Get()
  @ApiOperation({ summary: 'List the full permission catalog (flat)' })
  @Permissions('permissions.manage.view')
  @ApiQuery({ name: 'module', required: false, type: String })
  async list(@Query() pagination: PaginationDto, @Query('module') module: string, @Req() req: Request) {
    const { data, total } = await this.permissionsService.list(module, pagination);
    const meta = buildMetaFromRequest(req);
    return new ListEnvelope(data, total, pagination.page ?? 1, pagination.page_size ?? 20, meta);
  }

  @Get('grouped')
  @ApiOperation({ summary: 'Permission catalog grouped by module then resource' })
  @Permissions('permissions.manage.view')
  async grouped(@Req() req: Request) {
    const grouped = await this.permissionsService.grouped();
    const meta = buildMetaFromRequest(req);
    return new SuccessEnvelope(grouped, meta);
  }
}
