import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthContext } from '../auth-context.service';

export interface TenantContext {
  merchantId: string | null;
  storeId: string | null;
  isSuperAdmin: boolean;
}

export const StoreScope = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest<{
      authContext?: AuthContext;
      headers: Record<string, string | string[] | undefined>;
    }>();
    const authContext = request.authContext;

    if (!authContext) {
      return { merchantId: null, storeId: null, isSuperAdmin: false };
    }

    const isSuperAdmin = authContext.roles.some(
      (r) => r.code === 'super_admin',
    );

    const merchantId =
      (request.headers['x-merchant-id'] as string) ??
      authContext.roles.find((r: AuthContext['roles'][number]) => r.merchantId)
        ?.merchantId ??
      null;

    const storeId =
      (request.headers['x-store-id'] as string) ??
      authContext.roles.find((r: AuthContext['roles'][number]) => r.storeId)
        ?.storeId ??
      null;

    return { merchantId, storeId, isSuperAdmin };
  },
);
