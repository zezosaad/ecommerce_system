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

export class JwtInvalidError extends UnauthorizedException {
  code: string;
  constructor(code: string, message: string) {
    super({ code, message });
    this.name = 'JwtInvalidError';
    this.code = code;
  }
}

const SYMMETRIC_ALGS = new Set(['HS256', 'HS384', 'HS512']);
const ASYMMETRIC_ALGS = new Set(['RS256', 'RS384', 'RS512', 'ES256', 'ES384']);

type JwtAlgMode = 'hmac' | 'jwks' | 'auto';

@Injectable()
export class JwtVerifier {
  private readonly logger = new Logger(JwtVerifier.name);
  private readonly audience: string;
  private readonly issuer: string;
  private readonly clockTolerance: number;
  private readonly hmacKey: Uint8Array | null;
  private readonly algMode: JwtAlgMode;

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
    this.clockTolerance =
      Number(configService.get('JWT_CLOCK_TOLERANCE_SECONDS')) || 30;

    const jwtSecret = configService.get('SUPABASE_JWT_SECRET', { infer: true });
    this.hmacKey = jwtSecret ? new TextEncoder().encode(jwtSecret) : null;
    this.algMode =
      (configService.get('JWT_ALG_MODE', { infer: true }) as JwtAlgMode) ?? 'auto';

    if (this.algMode === 'hmac' && !this.hmacKey) {
      throw new Error(
        'JWT_ALG_MODE=hmac requires SUPABASE_JWT_SECRET to be configured.',
      );
    }
  }

  async verify(token: string): Promise<JwtPayload> {
    try {
      const header = this.decodeHeader(token);
      const alg = header.alg;
      if (!alg) {
        throw new JwtInvalidError(
          ErrorCode.AUTH_JWT_MALFORMED,
          'Token header missing alg.',
        );
      }

      let key: KeyLike | Uint8Array;
      let allowedAlgs: string[];

      if (SYMMETRIC_ALGS.has(alg)) {
        if (this.algMode === 'jwks') {
          throw new JwtInvalidError(
            ErrorCode.AUTH_JWT_INVALID,
            'HMAC tokens are not accepted (JWT_ALG_MODE=jwks).',
          );
        }
        if (!this.hmacKey) {
          throw new JwtInvalidError(
            ErrorCode.AUTH_JWT_INVALID,
            'Token signed with HMAC but SUPABASE_JWT_SECRET is not configured.',
          );
        }
        key = this.hmacKey;
        allowedAlgs = [alg];
      } else if (ASYMMETRIC_ALGS.has(alg)) {
        if (this.algMode === 'hmac') {
          throw new JwtInvalidError(
            ErrorCode.AUTH_JWT_INVALID,
            'Asymmetric tokens are not accepted (JWT_ALG_MODE=hmac).',
          );
        }
        if (!header.kid) {
          throw new JwtInvalidError(
            ErrorCode.AUTH_JWT_MALFORMED,
            'Asymmetric token missing key ID (kid).',
          );
        }
        const fetched = (await this.jwksCache.getKey(header.kid)) as KeyLike | null;
        if (!fetched) {
          throw new JwtInvalidError(
            ErrorCode.AUTH_JWT_INVALID,
            'Unable to verify token: key not found.',
          );
        }
        key = fetched;
        allowedAlgs = [alg];
      } else {
        throw new JwtInvalidError(
          ErrorCode.AUTH_JWT_INVALID,
          `Unsupported JWT algorithm: ${alg}`,
        );
      }

      const { payload } = await jwtVerify(token, key, {
        algorithms: allowedAlgs,
        issuer: this.issuer,
        audience: this.audience,
        clockTolerance: this.clockTolerance,
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
      if (error instanceof UnauthorizedException || error instanceof JwtInvalidError) {
        throw error;
      }

      const err = error as Error;
      if (err.name === 'JWTExpired') {
        throw new JwtInvalidError(
          ErrorCode.AUTH_JWT_EXPIRED,
          'Token has expired.',
        );
      }

      if (
        err.name === 'JWSSignatureVerificationFailed' ||
        err.name === 'JWSInvalid' ||
        err.name === 'JWTInvalid'
      ) {
        throw new JwtInvalidError(
          ErrorCode.AUTH_JWT_INVALID,
          'Token verification failed.',
        );
      }

      this.logger.warn(`JWT verification failed: ${err.message}`);
      throw new JwtInvalidError(
        ErrorCode.AUTH_JWT_INVALID,
        'Token verification failed.',
      );
    }
  }

  private decodeHeader(token: string): { kid?: string; alg?: string } {
    try {
      return decodeProtectedHeader(token);
    } catch {
      throw new JwtInvalidError(
        ErrorCode.AUTH_JWT_MALFORMED,
        'Token is malformed.',
      );
    }
  }
}
