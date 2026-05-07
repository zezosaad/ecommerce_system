import { Module } from '@nestjs/common';
import { SupabaseWebhookController } from './supabase-webhook.controller';
import { WebhookSignatureGuard } from './webhook-signature.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SupabaseWebhookController],
  providers: [WebhookSignatureGuard],
  exports: [WebhookSignatureGuard],
})
export class WebhooksModule {}
