import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  APP_ENV: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development'),
  APP_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGINS: z.string().default('http://localhost:3001,http://localhost:3002'),
  JWKS_TTL_SECONDS: z.coerce.number().int().min(60).default(3600),
  JWKS_REFRESH_SECONDS: z.coerce.number().int().min(30).default(900),
  IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().min(60).default(86400),
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
