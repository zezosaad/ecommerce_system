import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { ListEnvelope } from '../common/envelopes';
import { buildMetaFromRequest } from '../common/envelopes/meta';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto';

@ApiTags('Tax')
@Controller('tax-classes')
export class TaxClassesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List tax classes' })
  async list(@Query() pagination: PaginationDto, @Req() req: Request) {
    const page = pagination.page ?? 1;
    const pageSize = pagination.page_size ?? 20;
    const meta = buildMetaFromRequest(req);

    const [classes, total] = await Promise.all([
      this.prisma.taxClass.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.taxClass.count(),
    ]);

    return new ListEnvelope(classes, total, page, pageSize, meta);
  }
}

@ApiTags('Tax')
@Controller('country-tax-rules')
export class CountryTaxRulesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List country tax rules' })
  async list(@Query() pagination: PaginationDto, @Req() req: Request) {
    const page = pagination.page ?? 1;
    const pageSize = pagination.page_size ?? 20;
    const meta = buildMetaFromRequest(req);

    const [rules, total] = await Promise.all([
      this.prisma.countryTaxRule.findMany({
        include: { taxClass: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { countryCode: 'asc' },
      }),
      this.prisma.countryTaxRule.count(),
    ]);

    return new ListEnvelope(rules, total, page, pageSize, meta);
  }
}
