import { Global, Module } from '@nestjs/common';
import { JwtVerifier } from './jwt.verifier';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthContextService } from './auth-context.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PermissionsGuard } from './permissions.guard';
import { RolesGuard } from './roles.guard';
import { StoreScopeGuard } from './store-scope.guard';
import { EffectivePermissionsService } from './effective-permissions.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuditModule } from '../audit/audit.module';
import { ScopeProjectorService } from '../common/tenant/scope-projector.service';

@Global()
@Module({
  imports: [SupabaseModule, AuditModule],
  controllers: [AuthController],
  providers: [
    JwtVerifier,
    JwtAuthGuard,
    AuthContextService,
    AuthService,
    EffectivePermissionsService,
    PermissionsGuard,
    RolesGuard,
    StoreScopeGuard,
    ScopeProjectorService,
  ],
  exports: [
    JwtVerifier,
    JwtAuthGuard,
    AuthContextService,
    AuthService,
    EffectivePermissionsService,
    PermissionsGuard,
    RolesGuard,
    StoreScopeGuard,
    ScopeProjectorService,
  ],
})
export class AuthModule {}
