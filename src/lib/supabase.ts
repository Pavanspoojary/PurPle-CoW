import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.servic_role ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })
  : null;

export interface RepositoryRecord {
  id: string;
  organization_id: string;
  full_name: string;
  default_branch: string;
  sitemap_url?: string;
  created_at?: string;
}

export interface UrlTargetRecord {
  id: string;
  normalized_url: string;
  type: 'INTERNAL_ROUTE' | 'EXTERNAL_URL';
  domain: string;
  status_code?: number | null;
  is_alive: boolean;
  last_checked_at?: string;
  consecutive_fails: number;
}

export interface OccurrenceRecord {
  id: string;
  repository_id: string;
  url_target_id: string;
  file_path: string;
  start_line: number;
  end_line: number;
  anchor_text?: string;
  is_layout: boolean;
}

export interface MonitoredPageRecord {
  id: string;
  repository_id: string;
  route_path: string;
  severity: 'P0_CRITICAL' | 'P1_HIGH' | 'P2_LOW';
}

export interface IncidentRecord {
  id: string;
  repository_id: string;
  url_target_id: string;
  severity: 'P0_CRITICAL' | 'P1_HIGH' | 'P2_LOW';
  blast_radius_count: number;
  remediation_type?: string;
  remediation_suggestion?: string;
  remediation_diff?: string;
  pull_request_url?: string;
  status: 'OPEN' | 'PR_CREATED' | 'RESOLVED' | 'IGNORED';
  created_at?: string;
  // Joins
  url?: string;
  file_path?: string;
  start_line?: number;
  impacted_pages?: string[];
}

export interface UsageTrackingRecord {
  id: string;
  organization_id: string;
  plan_name: string;
  monthly_limit: number;
  current_usage: number;
  max_repositories: number;
}
