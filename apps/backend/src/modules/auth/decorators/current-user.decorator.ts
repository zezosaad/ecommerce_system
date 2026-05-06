import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthContext } from '../auth-context.service';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.authContext as AuthContext;
  },
);
