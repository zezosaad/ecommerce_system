import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { ListEnvelope } from '../common/envelopes';
import { buildMetaFromRequest } from '../common/envelopes/meta';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto';

@ApiTags('Currencies')
@Controller('currencies')
export class CurrenciesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List currencies' })
  async list(@Query() pagination: PaginationDto, @Req() req: Request) {
    const page = pagination.page ?? 1;
    const pageSize = pagination.page_size ?? 20;
    const meta = buildMetaFromRequest(req);

    const [currencies, total] = await Promise.all([
      this.prisma.currency.findMany({
        where: { isActive: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { code: 'asc' },
      }),
      this.prisma.currency.count({ where: { isActive: true } }),
    ]);

    return new ListEnvelope(currencies, total, page, pageSize, meta);
  }
}
