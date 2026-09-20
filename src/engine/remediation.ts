import { readFileSync, existsSync } from 'fs';

export interface RemediationResult {
  type: 'SITEMAP_MATCH' | 'WAYBACK_REDIRECT' | 'MANUAL_REQUIRED';
  suggestedUrl: string;
  diff: string;
  pullRequestTitle: string;
  pullRequestBody: string;
  redirectConfigJson?: string;
}

export class RemediationEngine {
  /**
   * Simple Levenshtein distance implementation for route matching
   */
  private static levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * Find closest live route in sitemap / project
   */
  static findClosestRoute(deadPath: string, liveRoutes: string[]): string | null {
    if (liveRoutes.length === 0) return null;

    let bestMatch: string | null = null;
    let minScore = Infinity;

    const cleanDead = deadPath.toLowerCase().replace(/^\//, '');
    const deadSegments = cleanDead.split(/[-_/]/);

    for (const route of liveRoutes) {
      if (route === deadPath) continue;
      const cleanRoute = route.toLowerCase().replace(/^\//, '');
      const routeSegments = cleanRoute.split(/[-_/]/);

      // 1. Direct Levenshtein on full path
      const fullDist = this.levenshtein(cleanDead, cleanRoute);

      // 2. Segment overlap bonus
      let segmentBonus = 0;
      for (const ds of deadSegments) {
        if (ds.length > 2 && routeSegments.some(rs => rs.includes(ds) || ds.includes(rs))) {
          segmentBonus += 4;
        }
      }

      // Check if version upgrade pattern (e.g. v2 -> v3)
      if (cleanDead.includes('v2') && cleanRoute.includes('v3')) {
        segmentBonus += 6;
      }

      const score = fullDist - segmentBonus;

      if (score < minScore) {
        minScore = score;
        bestMatch = route;
      }
    }

    return bestMatch || liveRoutes[0] || null;
  }

  /**
   * Query the Wayback Machine API for an archived external link
   */
  static async queryWayback(url: string): Promise<string | null> {
    try {
      const endpoint = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
      const res = await fetch(endpoint, {
        headers: { 'User-Agent': 'DeadLinkInsurance/1.0' },
      });
      if (!res.ok) return null;

      const data = await res.json() as any;
      if (data?.archived_snapshots?.closest?.available) {
        return data.archived_snapshots.closest.url;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Generate unified git diff for the file change
   */
  static generateDiff(filePath: string, startLine: number, deadUrl: string, replacementUrl: string): string {
    let originalLine = deadUrl;
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      if (lines[startLine - 1]) {
        originalLine = lines[startLine - 1];
      }
    }

    const modifiedLine = originalLine.replace(deadUrl, replacementUrl);

    return `--- a/${filePath}
+++ b/${filePath}
@@ -${startLine},1 +${startLine},1 @@
- ${originalLine}
+ ${modifiedLine}`;
  }

  /**
   * Remediation pipeline for a broken link
   */
  static async resolve(
    deadUrl: string,
    filePath: string,
    startLine: number,
    blastRadiusCount: number,
    knownLiveRoutes: string[] = []
  ): Promise<RemediationResult> {
    const isInternal = deadUrl.startsWith('/');

    if (isInternal) {
      const matched = this.findClosestRoute(deadUrl, knownLiveRoutes);
      const suggested = matched || '/docs';
      const diff = this.generateDiff(filePath, startLine, deadUrl, suggested);
      
      const redirectSnippet = JSON.stringify(
        {
          source: deadUrl,
          destination: suggested,
          permanent: true,
        },
        null,
        2
      );

      return {
        type: 'SITEMAP_MATCH',
        suggestedUrl: suggested,
        diff,
        pullRequestTitle: `fix(links): repair broken internal route ${deadUrl} (affects ${blastRadiusCount} pages)`,
        pullRequestBody: `### Dead Link Insurance: Auto-Remediation
**Issue Detected**: Internal route \`${deadUrl}\` returned 404.
- **Root Source**: \`${filePath}\` (Line ${startLine})
- **Blast Radius**: ${blastRadiusCount} live pages affected.
- **Suggested Fix**: Matched closest working route in sitemap: \`${suggested}\`.

Merge this PR to immediately restore navigation integrity.`,
        redirectConfigJson: redirectSnippet,
      };
    }

    // External URL resolution
    const wayback = await this.queryWayback(deadUrl);
    const suggested = wayback || deadUrl;
    const type = wayback ? 'WAYBACK_REDIRECT' : 'MANUAL_REQUIRED';
    const diff = wayback ? this.generateDiff(filePath, startLine, deadUrl, suggested) : '';

    return {
      type,
      suggestedUrl: suggested,
      diff,
      pullRequestTitle: `fix(docs): repair external dead link ${deadUrl}`,
      pullRequestBody: `### Dead Link Insurance: Auto-Remediation
**Issue Detected**: External target \`${deadUrl}\` is dead.
- **Root Source**: \`${filePath}\` (Line ${startLine})
- **Blast Radius**: ${blastRadiusCount} pages affected.
- **Remediation**: ${wayback ? `Found verified archive snapshot: [Wayback Mirror](${wayback})` : 'Manual replacement needed'}.`,
    };
  }
}
