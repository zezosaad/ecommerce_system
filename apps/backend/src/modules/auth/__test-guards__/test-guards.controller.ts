import { Controller, Get, Post, Body } from '@nestjs/common';
import { Public } from '../decorators/public.decorator';
import { OptionalAuth } from '../decorators/optional-auth.decorator';
import { Roles } from '../decorators/roles.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import { StoreScope } from '../store-scope.guard';

@Controller('__test-guards__')
export class TestGuardsController {
  @Get('public')
  @Public()
  publicEndpoint() {
    return { message: 'public' };
  }

  @Get('authenticated')
  authenticatedEndpoint() {
    return { message: 'authenticated' };
  }

  @Get('roles')
  @Roles('super_admin')
  rolesEndpoint() {
    return { message: 'roles' };
  }

  @Get('permissions')
  @Permissions('platform.settings.read')
  permissionsEndpoint() {
    return { message: 'permissions' };
  }

  @Get('optional')
  @OptionalAuth()
  optionalAuthEndpoint() {
    return { message: 'optional' };
  }

  @Get('store-scope')
  @StoreScope({ param: 'merchantId', source: 'query' })
  storeScopeEndpoint() {
    return { message: 'store-scope' };
  }

  @Post('combined')
  @Roles('merchant_admin')
  @Permissions('merchant.stores.read')
  @StoreScope({ param: 'storeId', source: 'body' })
  combinedEndpoint(@Body() body: { storeId?: string }) {
    return { message: 'combined', storeId: body.storeId };
  }
}
