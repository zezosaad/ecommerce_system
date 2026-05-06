import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { ListEnvelope } from '../common/envelopes';
import { buildMetaFromRequest } from '../common/envelopes/meta';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List all roles' })
  async list(@Query() pagination: PaginationDto, @Req() req: Request) {
    const page = pagination.page ?? 1;
    const pageSize = pagination.page_size ?? 20;

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.role.count(),
    ]);

    const meta = buildMetaFromRequest(req);
    return new ListEnvelope(roles, total, page, pageSize, meta);
  }
}
