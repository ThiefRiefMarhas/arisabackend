import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private supabaseClient: SupabaseClient;
  private supabaseAdminClient: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('supabase.url');
    const supabaseAnonKey = this.configService.get<string>('supabase.anonKey');
    const supabaseServiceRoleKey = this.configService.get<string>(
      'supabase.serviceRoleKey',
    );

    if (!supabaseUrl || !supabaseAnonKey) {
      this.logger.warn(
        'Supabase URL or Anon Key is not configured. Check your .env file.',
      );
    } else {
      // Public client (for user-facing operations)
      this.supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
      this.logger.log('Supabase public client initialized');
    }

    if (supabaseUrl && supabaseServiceRoleKey) {
      // Admin client (for server-side operations — bypasses RLS)
      this.supabaseAdminClient = createClient(
        supabaseUrl,
        supabaseServiceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      );
      this.logger.log('Supabase admin client initialized');
    }
  }

  /**
   * Public client — subject to RLS policies.
   * Use for user authentication operations.
   */
  getClient(): SupabaseClient {
    return this.supabaseClient;
  }

  /**
   * Admin/service-role client — bypasses RLS.
   * Use for server-side operations (e.g., user lookup, admin actions).
   */
  getAdminClient(): SupabaseClient {
    return this.supabaseAdminClient;
  }
}
