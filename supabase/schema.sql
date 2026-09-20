-- ============================================================================
-- DEAD LINK INSURANCE: SUPABASE SCHEMA
-- "One Plan + Usage Cap" ($29/mo, 2,500 links, 3 repos)
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Repositories
CREATE TABLE IF NOT EXISTS repositories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL DEFAULT 'default-org',
  full_name TEXT NOT NULL UNIQUE,
  default_branch TEXT NOT NULL DEFAULT 'main',
  sitemap_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Deduplicated URL Targets (Global Cache & Verification State)
CREATE TABLE IF NOT EXISTS url_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  normalized_url TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('INTERNAL_ROUTE', 'EXTERNAL_URL')),
  domain TEXT NOT NULL,
  status_code INT,
  is_alive BOOLEAN NOT NULL DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  consecutive_fails INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_url_targets_domain ON url_targets(domain);
CREATE INDEX IF NOT EXISTS idx_url_targets_alive_last_checked ON url_targets(is_alive, last_checked_at);

-- 3. AST Occurrences (Exact File/Line in Source Code)
CREATE TABLE IF NOT EXISTS occurrences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  url_target_id UUID NOT NULL REFERENCES url_targets(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  start_line INT NOT NULL,
  end_line INT NOT NULL,
  anchor_text TEXT,
  is_layout BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_occurrences_repo_file ON occurrences(repository_id, file_path);
CREATE INDEX IF NOT EXISTS idx_occurrences_target ON occurrences(url_target_id);

-- 4. Monitored Live Pages / Routes
CREATE TABLE IF NOT EXISTS monitored_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  route_path TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'P1_HIGH' CHECK (severity IN ('P0_CRITICAL', 'P1_HIGH', 'P2_LOW')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_repo_route UNIQUE (repository_id, route_path)
);

-- 5. Blast Radius Graph (Maps component link occurrences to all affected live pages)
CREATE TABLE IF NOT EXISTS page_occurrences (
  occurrence_id UUID NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  monitored_page_id UUID NOT NULL REFERENCES monitored_pages(id) ON DELETE CASCADE,
  PRIMARY KEY (occurrence_id, monitored_page_id)
);

-- 6. High-Signal Actionable Incidents
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  url_target_id UUID NOT NULL REFERENCES url_targets(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'P1_HIGH' CHECK (severity IN ('P0_CRITICAL', 'P1_HIGH', 'P2_LOW')),
  blast_radius_count INT NOT NULL DEFAULT 1,
  remediation_type TEXT, -- 'SITEMAP_MATCH', 'WAYBACK_REDIRECT', 'MANUAL'
  remediation_suggestion TEXT,
  remediation_diff TEXT,
  pull_request_url TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PR_CREATED', 'RESOLVED', 'IGNORED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_repo_status ON incidents(repository_id, status);

-- 7. "One Plan + Usage Cap" Meter
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id TEXT NOT NULL UNIQUE DEFAULT 'default-org',
  plan_name TEXT NOT NULL DEFAULT '$29/mo Flat Plan',
  monthly_limit INT NOT NULL DEFAULT 2500,
  current_usage INT NOT NULL DEFAULT 0,
  max_repositories INT NOT NULL DEFAULT 3,
  billing_cycle_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial usage record for default organization if not present
INSERT INTO usage_tracking (organization_id, plan_name, monthly_limit, current_usage, max_repositories)
VALUES ('default-org', '$29/mo Flat Plan', 2500, 0, 3)
ON CONFLICT (organization_id) DO NOTHING;
