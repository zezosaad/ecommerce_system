import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AllowPendingVerification } from '../auth/decorators/allow-profileless.decorator';
import { MeService } from './me.service';
import { Request } from 'express';

@ApiTags('Me')
@Controller('api/v1/me')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@AllowPendingVerification()
export class MeController {
  constructor(private meService: MeService) {}

  @Get('permissions')
  @Throttle({ 'me-read': { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Get current user permissions' })
  @ApiResponse({ status: 200, description: 'Permissions list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPermissions(@Req() req: Request) {
    const userId = req.authContext?.userId;
    const result = await this.meService.getPermissions(userId!);
    return {
      success: true,
      data: result,
    };
  }

  @Get('roles')
  @Throttle({ 'me-read': { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Get current user roles' })
  @ApiResponse({ status: 200, description: 'Roles list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRoles(@Req() req: Request) {
    const userId = req.authContext?.userId;
    const roles = await this.meService.getRoles(userId!);
    return {
      success: true,
      data: roles,
    };
  }

  @Get('access-scope')
  @Throttle({ 'me-read': { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Get current user access scope' })
  @ApiResponse({ status: 200, description: 'Access scope' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAccessScope(@Req() req: Request) {
    const userId = req.authContext?.userId;
    const scope = await this.meService.getAccessScope(userId!);
    return {
      success: true,
      data: scope,
    };
  }
}
