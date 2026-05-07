import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  SUPABASE_WEBHOOK_SECRET: z.string().min(1).optional(),
  JWT_AUDIENCE: z.string().min(1),
  JWT_CLOCK_TOLERANCE_SECONDS: z.coerce.number().int().min(0).default(30),
  /**
   * `hmac`  — accept only HMAC-signed tokens (uses SUPABASE_JWT_SECRET).
   * `jwks`  — accept only asymmetric tokens verified via Supabase JWKS.
   * `auto`  — accept whichever the token's header advertises (legacy).
   * Setting this explicitly avoids alg-confusion exposure.
   */
  JWT_ALG_MODE: z.enum(['hmac', 'jwks', 'auto']).default('auto'),
  APP_ENV: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development'),
  APP_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGINS: z.string().default('http://localhost:3001,http://localhost:3002'),
  JWKS_TTL_SECONDS: z.coerce.number().int().min(60).default(3600),
  JWKS_REFRESH_SECONDS: z.coerce.number().int().min(30).default(900),
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().min(60).default(86400),
  // FR-021: cache window <= 60 seconds. Cap at 60 to prevent misconfiguration.
  AUTH_PERMISSIONS_CACHE_TTL_SECONDS: z.coerce.number().int().min(10).max(60).default(60),
  AUTH_PERMISSIONS_CACHE_MAX: z.coerce.number().int().min(10).default(1000),
  RL_TTL_SECONDS: z.coerce.number().int().min(1).default(60),
  // FR-048: per-IP 10/min on sync-profile and Supabase webhook.
  RL_AUTH_SYNC_LIMIT: z.coerce.number().int().min(1).default(10),
  RL_WEBHOOK_SUPABASE_LIMIT: z.coerce.number().int().min(1).default(10),
  // FR-048: per-IP 5/min on password-reset webhook.
  RL_WEBHOOK_PWD_RESET_LIMIT: z.coerce.number().int().min(1).default(5),
  // FR-048: per-user 30/min on me/self-introspection.
  RL_ME_READ_LIMIT: z.coerce.number().int().min(1).default(30),
  // FR-048: per-user 20/min on user/role/permission writes.
  RL_ADMIN_WRITE_LIMIT: z.coerce.number().int().min(1).default(20),
  SUPERADMIN_EMAIL: z.string().email().optional(),
  SUPERADMIN_SUPABASE_USER_ID: z.string().uuid().optional(),
  SUPERADMIN_PASSWORD: z.string().min(8).optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues.map(
      (i) => `  - ${i.path.join('.')}: ${i.message}`,
    );
    throw new Error(
      `Environment validation failed:\n${errors.join('\n')}\n\nPlease check your .env file.`,
    );
  }
  return result.data;
}
