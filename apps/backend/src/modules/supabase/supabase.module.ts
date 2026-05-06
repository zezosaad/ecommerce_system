import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { JwksCacheService } from './jwks-cache.service';

@Global()
@Module({
  providers: [SupabaseService, JwksCacheService],
  exports: [SupabaseService, JwksCacheService],
})
export class SupabaseModule {}
