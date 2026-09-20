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
