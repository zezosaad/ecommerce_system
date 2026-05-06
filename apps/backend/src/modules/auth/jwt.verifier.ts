import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decodeProtectedHeader, jwtVerify, KeyLike } from 'jose';
import { JwksCacheService } from '../supabase/jwks-cache.service';
import { EnvConfig } from '../config/env.schema';
import { ErrorCode } from '../common/errors/error-codes';

export interface JwtPayload {
  sub: string;
  email?: string;
  role?: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
}

@Injectable()
export class JwtVerifier {
  private readonly logger = new Logger(JwtVerifier.name);
  private readonly audience: string;
  private readonly issuer: string;

  constructor(
    private configService: ConfigService<EnvConfig>,
    private jwksCache: JwksCacheService,
  ) {
    const audience = configService.get('JWT_AUDIENCE', { infer: true });
    const supabaseUrl = configService.get('SUPABASE_URL', { infer: true });
    if (!audience || !supabaseUrl) {
      throw new Error('JWT_AUDIENCE and SUPABASE_URL are required');
    }
    this.audience = audience;
    this.issuer = `${supabaseUrl}/auth/v1`;
  }

  async verify(token: string): Promise<JwtPayload> {
    try {
      const header = this.decodeHeader(token);
      if (!header.kid) {
        throw new UnauthorizedException({
          code: ErrorCode.AUTH_JWT_MALFORMED,
          message: 'Token missing key ID (kid).',
        });
      }

      const key = (await this.jwksCache.getKey(header.kid)) as KeyLike | null;
      if (!key) {
        throw new UnauthorizedException({
          code: ErrorCode.AUTH_JWT_INVALID,
          message: 'Unable to verify token: key not found.',
        });
      }

      const { payload } = await jwtVerify(token, key, {
        algorithms: ['RS256'],
        issuer: this.issuer,
        audience: this.audience,
      });

      const aud = Array.isArray(payload.aud)
        ? payload.aud[0]
        : (payload.aud as string | undefined);

      return {
        sub: payload.sub as string,
        email: payload.email as string | undefined,
        role: payload.role as string | undefined,
        aud: aud ?? this.audience,
        iss: payload.iss as string,
        exp: payload.exp as number,
        iat: payload.iat as number,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      const err = error as Error;
      if (err.name === 'JWTExpired') {
        throw new UnauthorizedException({
          code: ErrorCode.AUTH_JWT_EXPIRED,
          message: 'Token has expired.',
        });
      }

      if (
        err.name === 'JWSSignatureVerificationFailed' ||
        err.name === 'JWSInvalid'
      ) {
        throw new UnauthorizedException({
          code: ErrorCode.AUTH_JWT_INVALID,
          message: 'Token signature verification failed.',
        });
      }

      this.logger.warn(`JWT verification failed: ${err.message}`);
      throw new UnauthorizedException({
        code: ErrorCode.AUTH_JWT_INVALID,
        message: 'Token verification failed.',
      });
    }
  }

  private decodeHeader(token: string): { kid?: string; alg?: string } {
    try {
      return decodeProtectedHeader(token);
    } catch {
      throw new UnauthorizedException({
        code: ErrorCode.AUTH_JWT_MALFORMED,
        message: 'Token is malformed.',
      });
    }
  }
}
