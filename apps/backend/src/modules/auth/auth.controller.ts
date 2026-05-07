import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Req,
  Res,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';
import { SyncProfileDto } from './dto/sync-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { Request, Response } from 'express';
import { ErrorCode } from '../common/errors/error-codes';
import {
  AllowProfileless,
  AllowPendingVerification,
} from './decorators/allow-profileless.decorator';

@ApiTags('Auth')
@Controller('api/v1/auth')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('me')
  @AllowPendingVerification()
  @Throttle({ 'me-read': { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Get current user identity envelope' })
  @ApiResponse({ status: 200, description: 'Identity envelope' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@Req() req: Request) {
    const userId = req.authContext?.userId;
    if (!userId) {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_UNEXPECTED,
        message: 'Auth context missing.',
      });
    }

    const envelope = await this.authService.getEnvelope(userId);
    return {
      success: true,
      data: envelope,
    };
  }

  @Post('sync-profile')
  @AllowProfileless()
  @AllowPendingVerification()
  @Throttle({ 'auth-sync': { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Sync or create user profile' })
  @ApiResponse({ status: 200, description: 'Profile synced' })
  @ApiResponse({ status: 201, description: 'Profile created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  async syncProfile(@Req() req: Request, @Body() body?: SyncProfileDto) {
    const jwtPayload = {
      sub: req.supabaseUserId!,
      email: req.jwtPayload?.email as string | undefined,
    };

    const { isNew, envelope } = await this.authService.syncProfile(
      jwtPayload,
      body,
    );

    const statusCode = isNew ? HttpStatus.CREATED : HttpStatus.OK;
    return {
      success: true,
      data: envelope,
      statusCode,
    };
  }

  @Patch('profile')
  @AllowPendingVerification()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  async updateProfile(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    const userId = req.authContext?.userId;
    if (!userId) {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_UNEXPECTED,
        message: 'Auth context missing.',
      });
    }

    const profile = await this.authService.updateProfile(userId, dto);
    return {
      success: true,
      data: profile,
    };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout (server-side audit only)' })
  @ApiResponse({ status: 204, description: 'Logout recorded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const userId = req.authContext?.userId;
    if (userId) {
      await this.authService.logout(userId);
    }

    res.status(HttpStatus.NO_CONTENT).send();
  }
}
