import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { ListEnvelope } from '../common/envelopes';
import { buildMetaFromRequest } from '../common/envelopes/meta';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto';

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List permission catalog' })
  async list(@Query() pagination: PaginationDto, @Req() req: Request) {
    const page = pagination.page ?? 1;
    const pageSize = pagination.page_size ?? 20;

    const [permissions, total] = await Promise.all([
      this.prisma.permission.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.permission.count(),
    ]);

    const meta = buildMetaFromRequest(req);
    return new ListEnvelope(permissions, total, page, pageSize, meta);
  }
}
