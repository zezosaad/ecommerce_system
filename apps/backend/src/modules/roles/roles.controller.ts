import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Req, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { RolesService } from './roles.service';
import { PermissionsService } from './permissions.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ListEnvelope, SuccessEnvelope } from '../common/envelopes';
import { buildMetaFromRequest } from '../common/envelopes/meta';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PaginationDto } from '../common/dto';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('api/v1/roles')
export class RolesController {
  constructor(
    private rolesService: RolesService,
    private permissionsService: PermissionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all roles (system + custom)' })
  @Permissions('roles.manage.view')
  @ApiQuery({ name: 'includePermissions', required: false, type: Boolean })
  async list(
    @Query() pagination: PaginationDto,
    @Query('includePermissions') includePermissions: string,
    @Req() req: Request,
  ) {
    const page = pagination.page ?? 1;
    const pageSize = pagination.page_size ?? 20;
    const include = includePermissions === 'true';

    const roles = await this.rolesService.list(include);
    const meta = buildMetaFromRequest(req);
    return new ListEnvelope(roles, roles.length, page, pageSize, meta);
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom role' })
  @Permissions('roles.manage.create')
  @Throttle({ 'admin-write': { limit: 20, ttl: 60000 } })
  async create(@Body() dto: CreateRoleDto, @Req() req: Request) {
    const actorId = req.authContext?.userId;
    const role = await this.rolesService.create(dto, actorId);
    const meta = buildMetaFromRequest(req);
    return new SuccessEnvelope(role, meta);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch one role with its full permission list' })
  @Permissions('roles.manage.view')
  async getById(@Param('id') id: string, @Req() req: Request) {
    const role = await this.rolesService.getById(id, true);
    const meta = buildMetaFromRequest(req);
    return new SuccessEnvelope(role, meta);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a role' })
  @Permissions('roles.manage.update')
  @Throttle({ 'admin-write': { limit: 20, ttl: 60000 } })
  async update(@Param('id') id: string, @Body() dto: UpdateRoleDto, @Req() req: Request) {
    const actorId = req.authContext?.userId;
    const role = await this.rolesService.update(id, dto, actorId);
    const meta = buildMetaFromRequest(req);
    return new SuccessEnvelope(role, meta);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a custom role' })
  @Permissions('roles.manage.delete')
  @Throttle({ 'admin-write': { limit: 20, ttl: 60000 } })
  async delete(@Param('id') id: string, @Req() req: Request): Promise<void> {
    const actorId = req.authContext?.userId;
    await this.rolesService.delete(id, actorId);
  }
}
