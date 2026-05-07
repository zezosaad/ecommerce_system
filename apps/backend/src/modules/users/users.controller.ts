import { Controller, Get, Patch, Param, Query, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { UsersService } from './users.service';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { SuccessEnvelope, ListEnvelope } from '../common/envelopes';
import { buildMetaFromRequest } from '../common/envelopes/meta';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Users (Admin)')
@ApiBearerAuth()
@Controller('api/v1/users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List application user profiles (admin)' })
  @Permissions('users.manage.view')
  @Throttle({ 'me-read': { limit: 30, ttl: 60000 } })
  async list(@Query() dto: ListUsersDto, @Req() req: Request) {
    const { data, total } = await this.usersService.list(dto);
    const meta = buildMetaFromRequest(req);
    return new ListEnvelope(data, total, dto.page ?? 1, dto.page_size ?? 20, meta);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a single user profile with roles and access scope' })
  @Permissions('users.manage.view')
  async getById(@Param('id') id: string, @Req() req: Request) {
    const result = await this.usersService.getById(id);
    const meta = buildMetaFromRequest(req);
    return new SuccessEnvelope(result, meta);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change a user status' })
  @Permissions('users.manage.suspend', 'users.manage.delete')
  @Throttle({ 'admin-write': { limit: 20, ttl: 60000 } })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: Request,
  ) {
    const actorId = req.authContext?.userId;
    const user = await this.usersService.setStatus(id, dto.status, actorId, dto.reason);
    const meta = buildMetaFromRequest(req);
    return new SuccessEnvelope(user, meta);
  }

  @Patch(':id/roles')
  @ApiOperation({ summary: 'Replace the set of role assignments for a user' })
  @Permissions('roles.manage.update')
  @Throttle({ 'admin-write': { limit: 20, ttl: 60000 } })
  async updateRoles(
    @Param('id') id: string,
    @Body() dto: UpdateUserRolesDto,
    @Req() req: Request,
  ) {
    const actorId = req.authContext?.userId;
    const result = await this.usersService.replaceRoles(id, dto, actorId);
    const meta = buildMetaFromRequest(req);
    return new SuccessEnvelope(result, meta);
  }
}
