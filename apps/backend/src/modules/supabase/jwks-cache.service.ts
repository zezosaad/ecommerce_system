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
  private endpointAvailable = true;

  private readonly ttlMs: number;
  private readonly refreshMs: number;
  private readonly supabaseUrl: string;
  private readonly supabaseAnonKey: string;

  constructor(private configService: ConfigService<EnvConfig>) {
    this.ttlMs = (configService.get('JWKS_TTL_SECONDS', { infer: true }) ?? 3600) * 1000;
    this.refreshMs = (configService.get('JWKS_REFRESH_SECONDS', { infer: true }) ?? 900) * 1000;
    const supabaseUrl = configService.get('SUPABASE_URL', { infer: true });
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL is required');
    }
    this.supabaseUrl = supabaseUrl;
    const supabaseAnonKey = configService.get('SUPABASE_ANON_KEY', { infer: true });
    if (!supabaseAnonKey) {
      throw new Error('SUPABASE_ANON_KEY is required');
    }
    this.supabaseAnonKey = supabaseAnonKey;
  }

  async onModuleInit(): Promise<void> {
    await this.refreshKeys({ throwWhenEmpty: false, isInitialProbe: true });
    if (!this.endpointAvailable) {
      this.logger.log(
        'JWKS endpoint not exposed by this Supabase project (asymmetric JWT signing not enabled). ' +
          'Falling back to HMAC verification via SUPABASE_JWT_SECRET. Background JWKS refresh disabled.',
      );
      return;
    }
    this.refreshInterval = setInterval(() => {
      this.refreshKeys({ throwWhenEmpty: false, isInitialProbe: false }).catch(
        (err) => {
          this.logger.warn(`Background JWKS refresh failed: ${err.message}`);
          this.lastFetchSuccess = false;
        },
      );
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

    if (!this.endpointAvailable) {
      return null;
    }

    return this.fetchKeyForKid(kid);
  }

  isHealthy(): boolean {
    if (!this.endpointAvailable) return true;
    if (this.cachedKeys.size === 0) return false;
    return this.lastFetchSuccess;
  }

  isDegraded(): boolean {
    if (!this.endpointAvailable) return false;
    if (this.cachedKeys.size > 0 && !this.lastFetchSuccess) return true;
    return false;
  }

  isJwksAvailable(): boolean {
    return this.endpointAvailable;
  }

  private async refreshKeys(options: {
    throwWhenEmpty: boolean;
    isInitialProbe?: boolean;
  }): Promise<void> {
    if (this.fetchInProgress) return;
    this.fetchInProgress = true;

    try {
      const jwks = await this.fetchJwks(5000);

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
      const message = (err as Error).message;
      // Only treat a 404 as "endpoint not available" during the initial
      // module-init probe, where the project has explicitly never exposed
      // JWKS. Transient 404s during background refresh must not permanently
      // disable verification — keep the cached keys and retry on the next
      // tick.
      if (message.includes('returned 404') && options.isInitialProbe) {
        this.endpointAvailable = false;
        this.stopBackgroundRefresh();
      } else {
        this.logger.warn(`JWKS fetch failed: ${message}. Cached keys still valid.`);
      }
      if (options.throwWhenEmpty && this.cachedKeys.size === 0 && this.endpointAvailable) {
        throw err;
      }
    } finally {
      this.fetchInProgress = false;
    }
  }

  private stopBackgroundRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  private async fetchKeyForKid(kid: string): Promise<unknown | null> {
    if (this.fetchInProgress) {
      const cached = this.cachedKeys.get(kid);
      return cached?.key ?? null;
    }

    try {
      this.fetchInProgress = true;
      const jwks = await this.fetchJwks(1000);
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

  private async fetchJwks(timeoutMs: number): Promise<{ keys?: Array<Record<string, unknown>> }> {
    const jwksUrl = `${this.supabaseUrl}/auth/v1/jwks`;
    const response = await fetch(jwksUrl, {
      headers: {
        apikey: this.supabaseAnonKey,
        Authorization: `Bearer ${this.supabaseAnonKey}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`JWKS endpoint returned ${response.status}`);
    }

    return response.json() as Promise<{ keys?: Array<Record<string, unknown>> }>;
  }

  onModuleDestroy(): void {
    this.stopBackgroundRefresh();
  }
}
