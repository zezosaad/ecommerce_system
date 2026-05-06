import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SuccessEnvelope } from '../common/envelopes';
import { buildMetaFromRequest } from '../common/envelopes/meta';
import { AuthContext } from '../auth/auth-context.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('me')
export class UsersController {
  @Get()
  @ApiOperation({ summary: 'Get current user profile, roles, and permissions' })
  async getMe(
    @CurrentUser()
    authContext: AuthContext,
    @Req() req: Request,
  ) {
    const meta = buildMetaFromRequest(req);
    return new SuccessEnvelope(
      {
        profile: {
          id: authContext.userId,
          supabase_user_id: authContext.supabaseUserId,
          email: authContext.email,
          display_name: authContext.displayName,
          avatar_url: authContext.avatarUrl,
          locale: authContext.locale,
          is_active: authContext.isActive,
        },
        roles: authContext.roles,
        permissions: authContext.permissions,
      },
      meta,
    );
  }
}
