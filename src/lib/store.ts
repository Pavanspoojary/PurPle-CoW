import {
  supabase,
  isSupabaseConfigured,
  RepositoryRecord,
  UrlTargetRecord,
  OccurrenceRecord,
  MonitoredPageRecord,
  IncidentRecord,
  UsageTrackingRecord,
} from './supabase.ts';

// High-speed local store with Supabase dual-sync
class Store {
  repositories: Map<string, RepositoryRecord> = new Map();
  urlTargets: Map<string, UrlTargetRecord> = new Map();
  occurrences: Map<string, OccurrenceRecord> = new Map();
  monitoredPages: Map<string, MonitoredPageRecord> = new Map();
  pageOccurrences: Set<string> = new Set(); // occurrenceId:monitoredPageId
  incidents: Map<string, IncidentRecord> = new Map();
  usage: UsageTrackingRecord = {
    id: 'default-usage',
    organization_id: 'default-org',
    plan_name: '$29/mo Flat Plan',
    monthly_limit: 2500,
    current_usage: 0,
    max_repositories: 3,
  };

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    // Seed initial demo data for instant dashboard preview
    const repo: RepositoryRecord = {
      id: 'repo-1',
      organization_id: 'default-org',
      full_name: 'acme/developer-portal',
      default_branch: 'main',
      sitemap_url: 'https://docs.acme.com/sitemap.xml',
      created_at: new Date().toISOString(),
    };
    this.repositories.set(repo.id, repo);

    // Initial usage
    this.usage.current_usage = 640;

    // Seed targets
    const target1: UrlTargetRecord = {
      id: 'target-v2',
      normalized_url: '/api/v2',
      type: 'INTERNAL_ROUTE',
      domain: 'internal',
      status_code: 404,
      is_alive: false,
      consecutive_fails: 2,
    };
    this.urlTargets.set(target1.id, target1);

    const target2: UrlTargetRecord = {
      id: 'target-spec',
      normalized_url: 'https://example-dead-domain-never-exists-987654321.org/spec',
      type: 'EXTERNAL_URL',
      domain: 'example-dead-domain-never-exists-987654321.org',
      status_code: 404,
      is_alive: false,
      consecutive_fails: 2,
    };
    this.urlTargets.set(target2.id, target2);

    // Seed occurrences
    const occ1: OccurrenceRecord = {
      id: 'occ-1',
      repository_id: repo.id,
      url_target_id: target1.id,
      file_path: 'components/DocsNav.tsx',
      start_line: 12,
      end_line: 12,
      is_layout: true,
    };
    this.occurrences.set(occ1.id, occ1);

    const occ2: OccurrenceRecord = {
      id: 'occ-2',
      repository_id: repo.id,
      url_target_id: target2.id,
      file_path: 'components/DocsNav.tsx',
      start_line: 13,
      end_line: 13,
      is_layout: true,
    };
    this.occurrences.set(occ2.id, occ2);

    // Seed monitored pages
    const p1: MonitoredPageRecord = { id: 'p1', repository_id: repo.id, route_path: '/pricing', severity: 'P0_CRITICAL' };
    const p2: MonitoredPageRecord = { id: 'p2', repository_id: repo.id, route_path: '/docs/quickstart', severity: 'P0_CRITICAL' };
    const p3: MonitoredPageRecord = { id: 'p3', repository_id: repo.id, route_path: '/docs/onboarding', severity: 'P0_CRITICAL' };
    const p4: MonitoredPageRecord = { id: 'p4', repository_id: repo.id, route_path: '/docs/api-v3', severity: 'P1_HIGH' };
    const p5: MonitoredPageRecord = { id: 'p5', repository_id: repo.id, route_path: '/changelog', severity: 'P2_LOW' };
    
    [p1, p2, p3, p4, p5].forEach(p => this.monitoredPages.set(p.id, p));

    // Link occurrences to pages
    [p1, p2, p3, p4, p5].forEach(p => {
      this.pageOccurrences.add(`${occ1.id}:${p.id}`);
      this.pageOccurrences.add(`${occ2.id}:${p.id}`);
    });

    // Seed incidents
    const inc1: IncidentRecord = {
      id: 'inc-1',
      repository_id: repo.id,
      url_target_id: target1.id,
      severity: 'P0_CRITICAL',
      blast_radius_count: 5,
      remediation_type: 'SITEMAP_MATCH',
      remediation_suggestion: '/docs/api-v3',
      remediation_diff: `--- a/components/DocsNav.tsx\n+++ b/components/DocsNav.tsx\n@@ -12,1 +12,1 @@\n- <li><a href="/api/v2">REST API v2 Reference</a></li>\n+ <li><a href="/docs/api-v3">REST API v2 Reference</a></li>`,
      pull_request_url: 'https://github.com/acme/developer-portal/pull/104',
      status: 'OPEN',
      created_at: new Date().toISOString(),
    };
    this.incidents.set(inc1.id, inc1);

    const inc2: IncidentRecord = {
      id: 'inc-2',
      repository_id: repo.id,
      url_target_id: target2.id,
      severity: 'P0_CRITICAL',
      blast_radius_count: 5,
      remediation_type: 'WAYBACK_REDIRECT',
      remediation_suggestion: 'https://web.archive.org/web/20240101000000/https://example-dead-domain-never-exists-987654321.org/spec',
      remediation_diff: `--- a/components/DocsNav.tsx\n+++ b/components/DocsNav.tsx\n@@ -13,1 +13,1 @@\n- <li><a href="https://example-dead-domain-never-exists-987654321.org/spec">Third-Party Protocol Spec</a></li>\n+ <li><a href="https://web.archive.org/web/20240101000000/https://example-dead-domain-never-exists-987654321.org/spec">Third-Party Protocol Spec (Archived Mirror)</a></li>`,
      pull_request_url: 'https://github.com/acme/developer-portal/pull/105',
      status: 'OPEN',
      created_at: new Date().toISOString(),
    };
    this.incidents.set(inc2.id, inc2);
  }

  async getRepository(fullName: string): Promise<RepositoryRecord> {
    for (const r of this.repositories.values()) {
      if (r.full_name === fullName) return r;
    }
    const newRepo: RepositoryRecord = {
      id: `repo-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      organization_id: 'default-org',
      full_name: fullName,
      default_branch: 'main',
      created_at: new Date().toISOString(),
    };
    this.repositories.set(newRepo.id, newRepo);

    if (supabase) {
      try {
        await supabase.from('repositories').upsert({
          full_name: newRepo.full_name,
          default_branch: newRepo.default_branch,
          organization_id: newRepo.organization_id,
        });
      } catch (e) {
        // Fallback to local store silently
      }
    }
    return newRepo;
  }

  async getOrCreateUrlTarget(url: string, type: 'INTERNAL_ROUTE' | 'EXTERNAL_URL'): Promise<UrlTargetRecord> {
    const normalized = url.trim();
    for (const target of this.urlTargets.values()) {
      if (target.normalized_url === normalized) return target;
    }

    let domain = 'internal';
    try {
      if (type === 'EXTERNAL_URL') {
        const parsed = new URL(normalized);
        domain = parsed.hostname;
      }
    } catch {
      domain = 'invalid-url';
    }

    const newTarget: UrlTargetRecord = {
      id: `url-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      normalized_url: normalized,
      type,
      domain,
      status_code: null,
      is_alive: true,
      consecutive_fails: 0,
    };
    this.urlTargets.set(newTarget.id, newTarget);
    return newTarget;
  }

  async recordOccurrence(data: Omit<OccurrenceRecord, 'id'>): Promise<OccurrenceRecord> {
    const id = `occ-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const record: OccurrenceRecord = { id, ...data };
    this.occurrences.set(id, record);
    return record;
  }

  async recordMonitoredPage(repoId: string, routePath: string, severity: 'P0_CRITICAL' | 'P1_HIGH' | 'P2_LOW'): Promise<MonitoredPageRecord> {
    const key = `${repoId}:${routePath}`;
    for (const page of this.monitoredPages.values()) {
      if (page.repository_id === repoId && page.route_path === routePath) {
        return page;
      }
    }
    const id = `page-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const page: MonitoredPageRecord = { id, repository_id: repoId, route_path: routePath, severity };
    this.monitoredPages.set(id, page);
    return page;
  }

  async linkPageOccurrence(occurrenceId: string, pageId: string) {
    this.pageOccurrences.add(`${occurrenceId}:${pageId}`);
  }

  async recordIncident(data: Omit<IncidentRecord, 'id'>): Promise<IncidentRecord> {
    // Deduplicate: check if open incident exists for this target and repo
    for (const inc of this.incidents.values()) {
      if (inc.repository_id === data.repository_id && inc.url_target_id === data.url_target_id && inc.status === 'OPEN') {
        inc.blast_radius_count = Math.max(inc.blast_radius_count, data.blast_radius_count);
        inc.severity = data.severity;
        inc.remediation_diff = data.remediation_diff || inc.remediation_diff;
        inc.remediation_suggestion = data.remediation_suggestion || inc.remediation_suggestion;
        return inc;
      }
    }

    const id = `inc-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const record: IncidentRecord = { id, ...data, created_at: new Date().toISOString() };
    this.incidents.set(id, record);

    if (supabase) {
      try {
        await supabase.from('incidents').insert({
          repository_id: data.repository_id,
          url_target_id: data.url_target_id,
          severity: data.severity,
          blast_radius_count: data.blast_radius_count,
          remediation_type: data.remediation_type,
          remediation_suggestion: data.remediation_suggestion,
          remediation_diff: data.remediation_diff,
          status: data.status,
        });
      } catch (e) {
        // Fallback to local store silently
      }
    }
    return record;
  }

  async getIncidents(): Promise<IncidentRecord[]> {
    const list: IncidentRecord[] = [];
    for (const inc of this.incidents.values()) {
      const target = this.urlTargets.get(inc.url_target_id);
      const occurrences = Array.from(this.occurrences.values()).filter(o => o.url_target_id === inc.url_target_id);
      const firstOcc = occurrences[0];
      
      const impactedPages: string[] = [];
      for (const occ of occurrences) {
        for (const pair of this.pageOccurrences) {
          const [occId, pageId] = pair.split(':');
          if (occId === occ.id) {
            const p = this.monitoredPages.get(pageId);
            if (p && !impactedPages.includes(p.route_path)) {
              impactedPages.push(p.route_path);
            }
          }
        }
      }

      list.push({
        ...inc,
        url: target ? target.normalized_url : 'unknown',
        file_path: firstOcc ? firstOcc.file_path : 'unknown',
        start_line: firstOcc ? firstOcc.start_line : 0,
        impacted_pages: impactedPages,
      });
    }
    return list.sort((a, b) => (b.severity === 'P0_CRITICAL' ? 1 : -1));
  }

  async incrementUsage(count: number = 1): Promise<{ allowed: boolean; current: number; limit: number }> {
    this.usage.current_usage += count;
    const allowed = this.usage.current_usage <= this.usage.monthly_limit;
    return {
      allowed,
      current: this.usage.current_usage,
      limit: this.usage.monthly_limit,
    };
  }

  async getUsage(): Promise<UsageTrackingRecord> {
    return this.usage;
  }
}

export const store = new Store();
