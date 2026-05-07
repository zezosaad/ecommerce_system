import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { importJWKS } from './jwks-utils';
import { EnvConfig } from '../config/env.schema';

interface CachedKey {
  kid: string;
  key: unknown;
  importedAt: number;
}

@Injectable()
export class JwksCacheService implements OnModuleInit {
  private readonly logger = new Logger(JwksCacheService.name);
  private cachedKeys: Map<string, CachedKey> = new Map();
  private lastFetchTime = 0;
  private lastFetchSuccess = true;
  private fetchInProgress = false;
  private refreshInterval: NodeJS.Timeout | null = null;

  private readonly ttlMs: number;
  private readonly refreshMs: number;
  private readonly supabaseUrl: string;

  constructor(private configService: ConfigService<EnvConfig>) {
    this.ttlMs = (configService.get('JWKS_TTL_SECONDS', { infer: true }) ?? 3600) * 1000;
    this.refreshMs = (configService.get('JWKS_REFRESH_SECONDS', { infer: true }) ?? 900) * 1000;
    const supabaseUrl = configService.get('SUPABASE_URL', { infer: true });
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL is required');
    }
    this.supabaseUrl = supabaseUrl;
  }

  async onModuleInit(): Promise<void> {
    await this.fetchKeys().catch((err) => {
      this.lastFetchSuccess = false;
      this.logger.warn(
        `Initial JWKS fetch failed (${(err as Error).message}). Continuing in degraded mode.`,
      );
    });
    this.refreshInterval = setInterval(() => {
      this.fetchKeys().catch((err) => {
        this.logger.warn(`Background JWKS refresh failed: ${err.message}`);
        this.lastFetchSuccess = false;
      });
    }, this.refreshMs);
  }

  async getKey(kid: string): Promise<unknown | null> {
    const cached = this.cachedKeys.get(kid);
    if (cached) {
      const age = Date.now() - cached.importedAt;
      if (age < this.ttlMs) {
        return cached.key;
      }
    }

    const fetchedKey = await this.fetchKeyForKid(kid);
    return fetchedKey;
  }

  isHealthy(): boolean {
    if (this.cachedKeys.size === 0) return false;
    return this.lastFetchSuccess;
  }

  isDegraded(): boolean {
    if (this.cachedKeys.size > 0 && !this.lastFetchSuccess) return true;
    return false;
  }

  private async fetchKeys(): Promise<void> {
    if (this.fetchInProgress) return;
    this.fetchInProgress = true;

    try {
      const jwksUrl = this.buildJwksUrl();
      const response = await fetch(jwksUrl, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`JWKS endpoint returned ${response.status}`);
      }

      const jwks = (await response.json()) as { keys?: Array<Record<string, unknown>> };

      const newKeys = new Map<string, CachedKey>();
      for (const key of jwks.keys ?? []) {
        const kid = typeof key.kid === 'string' ? key.kid : undefined;
        const kty = typeof key.kty === 'string' ? key.kty : undefined;
        if (kid && kty === 'RSA') {
          try {
            const cryptoKey = await importJWKS(key);
            newKeys.set(kid, {
              kid,
              key: cryptoKey,
              importedAt: Date.now(),
            });
          } catch (importErr) {
            this.logger.warn(`Failed to import key ${key.kid}: ${(importErr as Error).message}`);
          }
        }
      }

      if (newKeys.size > 0) {
        this.cachedKeys = newKeys;
        this.lastFetchTime = Date.now();
        this.lastFetchSuccess = true;
        this.logger.log(`JWKS cache refreshed with ${newKeys.size} keys`);
      }
    } catch (err) {
      this.lastFetchSuccess = false;
      this.logger.warn(`JWKS fetch failed: ${(err as Error).message}. Cached keys still valid.`);
      if (this.cachedKeys.size === 0) {
        throw err;
      }
    } finally {
      this.fetchInProgress = false;
    }
  }

  private async fetchKeyForKid(kid: string): Promise<unknown | null> {
    if (this.fetchInProgress) {
      const cached = this.cachedKeys.get(kid);
      return cached?.key ?? null;
    }

    try {
      this.fetchInProgress = true;
      const jwksUrl = this.buildJwksUrl();
      const response = await fetch(jwksUrl, {
        signal: AbortSignal.timeout(1000),
      });

      if (!response.ok) return null;

      const jwks = (await response.json()) as { keys?: Array<Record<string, unknown>> };
      for (const key of jwks.keys ?? []) {
        const keyKid = typeof key.kid === 'string' ? key.kid : undefined;
        const kty = typeof key.kty === 'string' ? key.kty : undefined;
        if (keyKid === kid && kty === 'RSA') {
          try {
            const cryptoKey = await importJWKS(key);
            this.cachedKeys.set(kid, {
              kid,
              key: cryptoKey,
              importedAt: Date.now(),
            });
            this.lastFetchSuccess = true;
            return cryptoKey;
          } catch {
            return null;
          }
        }
      }
      return null;
    } catch {
      return null;
    } finally {
      this.fetchInProgress = false;
    }
  }

  onModuleDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  private buildJwksUrl(): string {
    const base = this.supabaseUrl.replace(/\/+$/, '');
    if (base.endsWith('/auth/v1')) {
      return `${base}/jwks`;
    }
    return `${base}/auth/v1/jwks`;
  }
}
