import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route that may be reached by an authenticated Supabase user who
 * does NOT yet have an application profile (or has zero role assignments).
 * Used by `sync-profile`. The JWT is still validated.
 */
export const ALLOW_PROFILELESS_KEY = 'allowProfileless';
export const AllowProfileless = () =>
  SetMetadata(ALLOW_PROFILELESS_KEY, true);

/**
 * Marks a route that may be reached by users whose status is
 * `pending_verification`. Default policy blocks them.
 * Used by `me`, `sync-profile`, and self profile endpoints.
 */
export const ALLOW_PENDING_VERIFICATION_KEY = 'allowPendingVerification';
export const AllowPendingVerification = () =>
  SetMetadata(ALLOW_PENDING_VERIFICATION_KEY, true);
