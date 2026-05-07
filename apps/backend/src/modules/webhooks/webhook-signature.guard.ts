import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface WebhookRequest extends Request {
  rawBody?: Buffer;
  webhookDuplicate?: boolean;
  webhookEventId?: string;
  webhookEventType?: string;
  webhookPayload?: Record<string, unknown>;
  webhookRawBody?: string;
}

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<WebhookRequest>();
    const signature = request.headers['x-supabase-signature'] as string;

    if (!signature) {
      throw new UnauthorizedException({
        code: 'AUTH/WEBHOOK_SIGNATURE_MISSING',
        message: 'Missing X-Supabase-Signature header',
      });
    }

    const secret = this.configService.get<string>('SUPABASE_WEBHOOK_SECRET');
    if (!secret) {
      throw new UnauthorizedException({
        code: 'AUTH/WEBHOOK_CONFIG_ERROR',
        message: 'Webhook secret not configured',
      });
    }

    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new UnauthorizedException({
        code: 'AUTH/WEBHOOK_RAW_BODY_MISSING',
        message: 'Raw body not available for signature verification',
      });
    }

    const expectedSignature = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    let providedSignature = signature;
    const prefix = 'sha256=';
    if (providedSignature.startsWith(prefix)) {
      providedSignature = providedSignature.slice(prefix.length);
    }

    let signatureValid = false;
    try {
      signatureValid = timingSafeEqual(
        Buffer.from(providedSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      );
    } catch {
      signatureValid = false;
    }

    if (!signatureValid) {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(rawBody.toString()) as Record<string, unknown>;
      } catch {}

      const correlationId = (request.headers['x-correlation-id'] as string) ?? 'unknown';
      await this.auditService.write({
        actorUserId: undefined,
        actorRoleCodes: [],
        actionCode: 'auth.webhook.invalid_signature',
        targetType: 'WebhookEvent',
        targetId: (body.id as string) ?? null,
        correlationId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { source: 'supabase', eventType: body.type, reason: 'signature_mismatch' },
        severity: 'warning',
      });

      throw new UnauthorizedException({
        code: 'AUTH/WEBHOOK_SIGNATURE_INVALID',
        message: 'Invalid webhook signature',
      });
    }

    const rawBodyStr = rawBody.toString();
    let parsedBody: Record<string, unknown>;
    try {
      parsedBody = JSON.parse(rawBodyStr) as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException({
        code: 'AUTH/WEBHOOK_INVALID_BODY',
        message: 'Invalid JSON body',
      });
    }

    const eventId = parsedBody.id as string;
    const eventType = parsedBody.type as string;

    const existing = await this.prisma.webhookEvent.findUnique({
      where: { source_eventId: { source: 'supabase', eventId } },
    });

    if (existing) {
      request.webhookDuplicate = true;
      return true;
    }

    request.webhookEventId = eventId;
    request.webhookEventType = eventType;
    request.webhookPayload = parsedBody;
    request.webhookRawBody = rawBodyStr;

    return true;
  }
}
