import { Controller, Get, Query, Req, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Audit } from '../audit/decorators/audit.decorator';
// `CurrentUser` and `Public` are intentionally available in this template
// for engineers copying it. They are not used by the example endpoints
// below; uncomment when needed:
//   import { CurrentUser } from '../auth/decorators/current-user.decorator';
//   import { Public } from '../auth/decorators/public.decorator';
import { SuccessEnvelope, ListEnvelope } from '../common/envelopes';
import { buildMetaFromRequest } from '../common/envelopes/meta';
import { PaginationDto } from '../common/dto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthContextService } from '../auth/auth-context.service';
import { GetTenantContext } from '../auth/decorators/store-scope.decorator';
import { CreateTemplateDto } from './dto/create-template.dto';
import { TemplateService } from './template.service';

// TODO: Replace 'example' with your module name
@ApiTags('Example')
@ApiBearerAuth()
@Controller('example')
export class ExampleController {
  constructor(
    private prisma: PrismaService,
    private authContextService: AuthContextService,
    private templateService: TemplateService,
  ) {}

  @Get()
  @Permissions('platform.example.read')
  @Audit({ action: 'platform.example.list', severity: 'info' })
  @ApiOperation({ summary: 'List examples' })
  async list(
    @Query() pagination: PaginationDto,
    @GetTenantContext() scope: { merchantId: string | null; storeId: string | null; isSuperAdmin: boolean },
    @Req() req: Request,
  ) {
    const page = pagination.page ?? 1;
    const pageSize = pagination.page_size ?? 20;
    const meta = buildMetaFromRequest(req);

    // TODO: Replace with your Prisma model query
    const items = await this.templateService.list(scope);
    const total = items.length;

    return new ListEnvelope(items, total, page, pageSize, meta);
  }

  @Get(':id')
  @Permissions('platform.example.read')
  @Audit({ action: 'platform.example.read', severity: 'info' })
  @ApiOperation({ summary: 'Get a single example' })
  async getOne(@Req() req: Request) {
    const meta = buildMetaFromRequest(req);
    return new SuccessEnvelope({}, meta);
  }

  @Post()
  @Permissions('platform.example.create')
  @Audit({ action: 'platform.example.create', severity: 'info' })
  @ApiOperation({ summary: 'Create an example' })
  async create(@Body() _body: CreateTemplateDto, @Req() req: Request) {
    const meta = buildMetaFromRequest(req);
    return new SuccessEnvelope({}, meta);
  }
}
