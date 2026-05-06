import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EnvConfig } from '../config/env.schema';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private anonClient!: SupabaseClient;
  private serviceRoleClient!: SupabaseClient;

  constructor(private configService: ConfigService<EnvConfig>) {}

  onModuleInit(): void {
    const url = this.configService.get('SUPABASE_URL', { infer: true });
    const anonKey = this.configService.get('SUPABASE_ANON_KEY', { infer: true });
    const serviceRoleKey = this.configService.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true });

    if (!url || !anonKey || !serviceRoleKey) {
      throw new Error('Supabase configuration is missing required values.');
    }

    this.anonClient = createClient(url, anonKey);
    this.serviceRoleClient = createClient(url, serviceRoleKey);
  }

  getAnonClient(): SupabaseClient {
    return this.anonClient;
  }

  getServiceRoleClient(): SupabaseClient {
    return this.serviceRoleClient;
  }
}
