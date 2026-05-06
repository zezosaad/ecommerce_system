import { Global, Module } from '@nestjs/common';
import { JwtVerifier } from './jwt.verifier';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthContextService } from './auth-context.service';
import { PermissionsGuard } from './permissions.guard';
import { SupabaseModule } from '../supabase/supabase.module';

@Global()
@Module({
  imports: [SupabaseModule],
  providers: [JwtVerifier, JwtAuthGuard, AuthContextService, PermissionsGuard],
  exports: [JwtVerifier, JwtAuthGuard, AuthContextService, PermissionsGuard],
})
export class AuthModule {}
