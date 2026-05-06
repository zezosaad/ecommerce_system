import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtVerifier } from './jwt.verifier';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { ErrorCode } from '../common/errors/error-codes';
import { Request } from 'express';
import { AuthContextService } from './auth-context.service';

declare module 'express' {
  interface Request {
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

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException({
        code: ErrorCode.AUTH_JWT_MISSING,
        message: 'Authorization header is required.',
      });
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException({
        code: ErrorCode.AUTH_JWT_MALFORMED,
        message: 'Invalid authorization header format. Use: Bearer <token>',
      });
    }

    const payload = await this.jwtVerifier.verify(token);
    request.user = {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    request.authContext = await this.authContextService.resolve(
      payload.sub,
      payload.email,
    );

    return true;
  }
}
