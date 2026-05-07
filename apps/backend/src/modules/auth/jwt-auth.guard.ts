import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtVerifier } from './jwt.verifier';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { OPTIONAL_AUTH_KEY } from './decorators/optional-auth.decorator';
import {
  ALLOW_PROFILELESS_KEY,
  ALLOW_PENDING_VERIFICATION_KEY,
} from './decorators/allow-profileless.decorator';
import { ErrorCode } from '../common/errors/error-codes';
import { Request } from 'express';
import { AuthContextService } from './auth-context.service';

declare module 'express' {
  interface Request {
    supabaseUserId?: string;
    jwtPayload?: Record<string, unknown>;
    user?: {
      sub: string;
      email?: string;
      role?: string;
    };
    authContext?: import('./auth-context.service').AuthContext;
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtVerifier: JwtVerifier,
    private reflector: Reflector,
    private authContextService: AuthContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const isOptional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      if (isOptional) return true;
      throw new UnauthorizedException({
        code: ErrorCode.AUTH_JWT_MISSING,
        message: 'Authorization header is required.',
      });
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      if (isOptional) return true;
      throw new UnauthorizedException({
        code: ErrorCode.AUTH_JWT_MALFORMED,
        message: 'Invalid authorization header format. Use: Bearer <token>',
      });
    }

    let payload;
    try {
      payload = await this.jwtVerifier.verify(token);
    } catch (error) {
      if (isOptional) return true;
      throw error;
    }
    request.supabaseUserId = payload.sub;
    request.jwtPayload = payload as unknown as Record<string, unknown>;
    request.user = {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    const allowProfileless = !!this.reflector.getAllAndOverride<boolean>(
      ALLOW_PROFILELESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const allowPendingVerification = !!this.reflector.getAllAndOverride<boolean>(
      ALLOW_PENDING_VERIFICATION_KEY,
      [context.getHandler(), context.getClass()],
    );

    request.authContext = await this.authContextService.resolve(
      payload.sub,
      payload.email,
      { allowProfileless, allowPendingVerification },
    );

    return true;
  }
}
