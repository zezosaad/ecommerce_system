import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ConfigService } from '@nestjs/config';
import { EffectivePermissionsService } from './effective-permissions.service';
import { AuthContextService } from './auth-context.service';
import { ErrorCode } from '../common/errors/error-codes';
import { SyncProfileDto } from './dto/sync-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserStatus, RoleCode } from '@vendorhub/types';
import type { AuthEnvelopeDto, UserProfileDto } from '@vendorhub/types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private supabaseService: SupabaseService,
    private configService: ConfigService,
    private effectivePermissionsService: EffectivePermissionsService,
    private authContextService: AuthContextService,
  ) {}

  async syncProfile(
    jwtPayload: { sub: string; email?: string },
    body?: SyncProfileDto,
  ): Promise<{ isNew: boolean; envelope: AuthEnvelopeDto }> {
    const { sub: supabaseUserId, email: jwtEmail } = jwtPayload;
    const email = jwtEmail;

    let user = await this.prisma.user.findUnique({
      where: { supabaseUserId },
    });

    let isNew = false;

    if (!user) {
      isNew = true;
      const defaultLanguage = body?.preferredLanguage ?? 'en';
      const defaultCurrency = await this.getDefaultCurrency();

      user = await this.prisma.user.create({
        data: {
          supabaseUserId,
          email: email ?? 'unknown@example.com',
          firstName: body?.firstName,
          lastName: body?.lastName,
          phone: body?.phone,
          preferredLanguage: defaultLanguage,
          defaultCurrency,
          status: 'pending_verification' as UserStatus,
        },
      });

      const customerRole = await this.prisma.role.findUnique({
        where: { code: RoleCode.CUSTOMER },
      });

      if (customerRole) {
        await this.prisma.userRole.create({
          data: {
            userId: user.id,
            roleId: customerRole.id,
          },
        });
      }

      await this.auditService.write({
        actorUserId: user.id,
        actorRoleCodes: [],
        actionCode: 'auth.profile.created',
        targetType: 'User',
        targetId: user.id,
        correlationId: crypto.randomUUID(),
        metadata: { source: 'sync_profile' },
      });

      this.logger.log(`Created new user profile ${user.id} for ${supabaseUserId}`);
    } else {
      const updates: Record<string, unknown> = {};
      if (email && email !== user.email) updates.email = email;
      // Always bump lastSeenAt on a profile sync — previous logic only
      // updated when it was already non-null, leaving first-time users with
      // a permanently-null value.
      updates.lastSeenAt = new Date();

      user = await this.prisma.user.update({
        where: { id: user.id },
        data: updates,
      });
    }

    await this.reconcileStatusFromSupabase(user.id, supabaseUserId);

    const envelope = await this.getEnvelope(user.id);

    // SC-009: exactly one matching audit entry per logical action. For a
    // first-time sync, `auth.profile.created` was already written above;
    // do not also write `auth.login.profile_synced`.
    if (!isNew) {
      await this.auditService.write({
        actorUserId: user.id,
        actorRoleCodes: [],
        actionCode: 'auth.login.profile_synced',
        targetType: 'User',
        targetId: user.id,
        correlationId: crypto.randomUUID(),
        metadata: { isNew },
      });
    }

    return { isNew, envelope };
  }

  async getEnvelope(userId: string): Promise<AuthEnvelopeDto> {
    const authContext = await this.authContextService.resolveById(userId);

    const userProfile = {
      id: authContext.userId,
      email: authContext.email,
      phone: authContext.phone,
      firstName: authContext.firstName,
      lastName: authContext.lastName,
      avatarUrl: authContext.avatarUrl,
      preferredLanguage: authContext.preferredLanguage as 'en' | 'ar',
      defaultCurrency: authContext.defaultCurrency,
      status: authContext.status,
      createdAt: authContext.createdAt,
      updatedAt: authContext.updatedAt,
    };

    const roles = authContext.roles.map((r) => ({
      id: r.id,
      key: r.code,
      label: r.label as { en: string; ar: string },
      description: r.description as { en: string; ar: string } | null,
      isSystem: r.isSystem,
    }));

    return {
      user: userProfile,
      roles,
      permissions: authContext.permissions,
      accessScopes: (authContext.accessScopes || []).map((s) => ({
        scopeType: s.scopeType as 'platform' | 'merchant' | 'store',
        merchantId: s.merchantId,
        storeId: s.storeId,
      })),
      isSuperAdmin: authContext.permissions.includes('*'),
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'User not found',
      });
    }

    const updates: Record<string, unknown> = {};
    if (dto.firstName !== undefined) updates.firstName = dto.firstName;
    if (dto.lastName !== undefined) updates.lastName = dto.lastName;
    if (dto.avatarUrl !== undefined) updates.avatarUrl = dto.avatarUrl;
    if (dto.preferredLanguage !== undefined)
      updates.preferredLanguage = dto.preferredLanguage;
    if (dto.defaultCurrency !== undefined)
      updates.defaultCurrency = dto.defaultCurrency;
    if (dto.phone !== undefined) updates.phone = dto.phone;

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updates,
    });

    await this.auditService.write({
      actorUserId: userId,
      actorRoleCodes: [],
      actionCode: 'auth.profile.updated',
      targetType: 'User',
      targetId: userId,
      correlationId: crypto.randomUUID(),
      metadata: { fields: Object.keys(updates) },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      phone: updatedUser.phone,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      avatarUrl: updatedUser.avatarUrl,
      preferredLanguage: updatedUser.preferredLanguage as 'en' | 'ar',
      defaultCurrency: updatedUser.defaultCurrency,
      status: updatedUser.status as UserStatus,
      createdAt: updatedUser.createdAt.toISOString(),
      updatedAt: updatedUser.updatedAt.toISOString(),
    };
  }

  async reconcileStatusFromSupabase(
    userId: string,
    supabaseUserId: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.status !== 'pending_verification') {
      return;
    }

    try {
      const supabaseClient = this.supabaseService.getServiceRoleClient();
      const { data: supabaseUser } = await supabaseClient.auth.admin.getUserById(
        supabaseUserId,
      );

      if (supabaseUser?.user?.email_confirmed_at) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { status: 'active' as UserStatus },
        });

        // FR-021/SC-004: status change must propagate to permission decisions
        // within the documented window. Drop any cached envelope for this user.
        this.effectivePermissionsService.invalidate(userId);

        await this.auditService.write({
          actorUserId: userId,
          actorRoleCodes: [],
          actionCode: 'auth.profile.activated',
          targetType: 'User',
          targetId: userId,
          correlationId: crypto.randomUUID(),
          metadata: { source: 'lazy_reconcile', email_confirmed_at: supabaseUser.user.email_confirmed_at },
        });

        this.logger.log(`Activated user ${userId} via lazy reconciliation`);
      }
    } catch (error) {
      this.logger.warn(`Failed to reconcile status from Supabase: ${(error as Error).message}`);
    }
  }

  async logout(userId: string): Promise<void> {
    await this.auditService.write({
      actorUserId: userId,
      actorRoleCodes: [],
      actionCode: 'auth.logout',
      targetType: 'User',
      targetId: userId,
      correlationId: crypto.randomUUID(),
      metadata: {},
    });
  }

  private async getDefaultCurrency(): Promise<string> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key_merchantId: { key: 'platform.defaultCurrency', merchantId: '' } },
      });
      return (setting?.value as string) ?? 'USD';
    } catch {
      return 'USD';
    }
  }
}
