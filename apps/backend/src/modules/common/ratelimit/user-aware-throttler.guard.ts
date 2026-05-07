import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * FR-048 distinguishes per-IP and per-user thresholds. The default
 * Throttler tracker is IP-only; for `me-read` and `admin-write` the spec
 * mandates per-authenticated-user accounting. This tracker uses the
 * application user id when present (set by JwtAuthGuard) and falls back
 * to IP for unauthenticated requests (sync-profile, webhooks).
 */
const USER_BUCKETS = new Set(['me-read', 'admin-write']);

@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request, throttlerName?: string): Promise<string> {
    if (throttlerName && USER_BUCKETS.has(throttlerName)) {
      const userId = req.authContext?.userId;
      if (userId) return `user:${userId}`;
    }
    return req.ip ?? 'anonymous';
  }
}
