import { Global, Module } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerModule,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../config/env.schema';
import { UserAwareThrottlerGuard } from './user-aware-throttler.guard';

// FR-048 — defaults must match the spec exactly:
//   per-IP 10/min on sync-profile and Supabase webhook
//   per-IP 5/min on password-reset webhook
//   per-user 30/min on me/self-introspection
//   per-user 20/min on admin writes (users/roles/permissions)
const defaultBuckets = {
  authSync: { ttl: 60_000, limit: 10 },
  webhookSupabase: { ttl: 60_000, limit: 10 },
  webhookPwdReset: { ttl: 60_000, limit: 5 },
  meRead: { ttl: 60_000, limit: 30 },
  adminWrite: { ttl: 60_000, limit: 20 },
};

@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (
        config: ConfigService<EnvConfig>,
      ): ThrottlerModuleOptions => {
        const ttlSeconds = Number(config.get('RL_TTL_SECONDS')) || 60;
        const ttlMs = ttlSeconds * 1000;

        return {
          throttlers: [
            {
              name: 'auth-sync',
              ttl: ttlMs,
              limit: Number(config.get('RL_AUTH_SYNC_LIMIT')) || defaultBuckets.authSync.limit,
            },
            {
              name: 'webhook-supabase',
              ttl: ttlMs,
              limit: Number(config.get('RL_WEBHOOK_SUPABASE_LIMIT')) || defaultBuckets.webhookSupabase.limit,
            },
            {
              name: 'webhook-pwd-reset',
              ttl: ttlMs,
              limit: Number(config.get('RL_WEBHOOK_PWD_RESET_LIMIT')) || defaultBuckets.webhookPwdReset.limit,
            },
            {
              name: 'me-read',
              ttl: ttlMs,
              limit: Number(config.get('RL_ME_READ_LIMIT')) || defaultBuckets.meRead.limit,
            },
            {
              name: 'admin-write',
              ttl: ttlMs,
              limit: Number(config.get('RL_ADMIN_WRITE_LIMIT')) || defaultBuckets.adminWrite.limit,
            },
          ],
        };
      },
    }),
  ],
  providers: [{ provide: ThrottlerGuard, useClass: UserAwareThrottlerGuard }],
  exports: [ThrottlerModule, ThrottlerGuard],
})
export class RatelimitModule {}
