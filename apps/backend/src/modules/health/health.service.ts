import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwksCacheService } from '../supabase/jwks-cache.service';

export type DependencyStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
export type HealthStatus = 'ok' | 'degraded' | 'unhealthy';

export interface HealthResult {
  status: HealthStatus;
  version: string;
  uptime_seconds: number;
  dependencies: {
    db: DependencyStatus;
    auth: DependencyStatus;
    storage: DependencyStatus;
    search: DependencyStatus;
    cache: DependencyStatus;
  };
}

@Injectable()
export class HealthService {
  private readonly version = process.env.APP_VERSION ?? '0.1.0';

  constructor(
    private prisma: PrismaService,
    private jwksCache: JwksCacheService,
  ) {}

  async check(): Promise<HealthResult> {
    const db = await this.checkDb();
    const auth = this.checkAuth();
    const storage: DependencyStatus = 'unknown';
    const search: DependencyStatus = 'unknown';
    const cache: DependencyStatus = 'unknown';

    const deps = { db, auth, storage, search, cache };
    const status = this.computeOverallStatus(deps);

    return {
      status,
      version: this.version,
      uptime_seconds: Math.floor(process.uptime()),
      dependencies: deps,
    };
  }

  private async checkDb(): Promise<DependencyStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'healthy';
    } catch {
      return 'unhealthy';
    }
  }

  private checkAuth(): DependencyStatus {
    if (this.jwksCache.isHealthy()) return 'healthy';
    if (this.jwksCache.isDegraded()) return 'degraded';
    return 'unhealthy';
  }

  private computeOverallStatus(
    deps: Record<string, DependencyStatus>,
  ): HealthStatus {
    const values = Object.values(deps);
    if (values.some((v) => v === 'unhealthy')) return 'unhealthy';
    if (values.some((v) => v === 'degraded')) return 'degraded';
    return 'ok';
  }
}
