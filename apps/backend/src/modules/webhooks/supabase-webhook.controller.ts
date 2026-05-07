import { Controller, Post, Req, Logger, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EffectivePermissionsService } from '../auth/effective-permissions.service';
import { PostSupabaseAuthWebhookDto } from './dto/supabase-event.dto';
import { WebhookSignatureGuard } from './webhook-signature.guard';
import { Request } from 'express';

interface WebhookRequest extends Request {
  webhookDuplicate?: boolean;
  webhookEventId?: string;
  webhookEventType?: string;
  webhookPayload?: Record<string, unknown>;
  webhookRawBody?: string;
}

@ApiTags('Webhooks')
@Controller('api/v1/webhooks/supabase')
export class SupabaseWebhookController {
  private readonly logger = new Logger(SupabaseWebhookController.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private effectivePermissionsService: EffectivePermissionsService,
  ) {}

  @Post('auth')
  @Public()
  @UseGuards(WebhookSignatureGuard)
  @Throttle({ 'webhook-supabase': { limit: 10, ttl: 60000 } })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Consume Supabase Auth identity events',
    description:
      'Signature-verified, idempotent webhook handler for Supabase Auth events. ' +
      'Allow-list: user.created, user.email_confirmed, user.deleted.',
  })
  @ApiBody({ type: PostSupabaseAuthWebhookDto })
  async handleAuthEvent(
    @Req() req: WebhookRequest,
  ): Promise<{ success: boolean; duplicate: boolean }> {
    if (req.webhookDuplicate) {
      return { success: true, duplicate: true };
    }

    const eventId = req.webhookEventId!;
    const eventType = req.webhookEventType!;
    const payload = req.webhookPayload!;
    const rawBody = req.webhookRawBody!;

    const record = payload.record as Record<string, string | undefined> | undefined;
    if (!record) {
      throw new Error('Invalid webhook payload: missing record');
    }

    let processedAt: Date | null = null;
    let processingError: string | null = null;

    try {
      switch (eventType) {
        case 'user.created':
          await this.handleUserCreated(record.id!, record.email!);
          break;
        case 'user.email_confirmed':
          await this.handleEmailConfirmed(record.id!);
          break;
        case 'user.deleted':
          await this.handleUserDeleted(record.id!);
          break;
      }
      processedAt = new Date();
    } catch (error) {
      processingError = (error as Error).message;
      this.logger.error(`Webhook processing error: ${processingError}`);
    }

    await this.prisma.webhookEvent.create({
      data: {
        source: 'supabase',
        eventId,
        eventType,
        signatureValid: true,
        payload: JSON.parse(rawBody) as Prisma.InputJsonValue,
        receivedAt: new Date(),
        processedAt,
        processingError,
      },
    });

    if (processingError) {
      throw new Error(processingError);
    }

    return { success: true, duplicate: false };
  }

  private async handleUserCreated(supabaseUserId: string, email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { supabaseUserId },
    });
    if (existing) return;

    const customerRole = await this.prisma.role.findUnique({
      where: { code: 'customer' },
    });

    await this.prisma.user.create({
      data: {
        supabaseUserId,
        email,
        status: 'pending_verification',
        preferredLanguage: 'en',
        defaultCurrency: 'USD',
        userRoles: customerRole
          ? { create: [{ roleId: customerRole.id }] }
          : undefined,
      },
    });

    this.logger.log(`Webhook: created user profile for ${supabaseUserId}`);
  }

  private async handleEmailConfirmed(supabaseUserId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { supabaseUserId },
    });
    if (!user || user.status !== 'pending_verification') return;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { status: 'active' },
    });

    this.effectivePermissionsService.invalidate(user.id);

    await this.auditService.write({
      actorUserId: user.id,
      actorRoleCodes: [],
      actionCode: 'auth.profile.activated',
      targetType: 'User',
      targetId: user.id,
      correlationId: crypto.randomUUID(),
      metadata: { source: 'webhook', eventType: 'user.email_confirmed' },
    });

    this.logger.log(`Webhook: activated user ${user.id} via email_confirmed`);
  }

  private async handleUserDeleted(supabaseUserId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { supabaseUserId },
    });
    if (!user) return;

    const oldStatus = user.status;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { status: 'deleted', deletedAt: new Date() },
    });

    this.effectivePermissionsService.invalidate(user.id);

    await this.auditService.write({
      actorUserId: undefined,
      actorRoleCodes: [],
      actionCode: 'auth.profile.deleted',
      targetType: 'User',
      targetId: user.id,
      correlationId: crypto.randomUUID(),
      metadata: { source: 'webhook', eventType: 'user.deleted', oldStatus },
      severity: 'notice',
    });

    this.logger.log(`Webhook: soft-deleted user ${user.id} via user.deleted`);
  }
}
