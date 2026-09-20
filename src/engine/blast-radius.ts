import { ParsedFile, ExtractedLink } from './ast-parser.ts';

export interface RouteImpact {
  routePath: string;
  severity: 'P0_CRITICAL' | 'P1_HIGH' | 'P2_LOW';
  category: 'Onboarding' | 'Monetization' | 'Core Documentation' | 'Archive';
}

export interface ScoredBlastRadius {
  url: string;
  sourceFile: string;
  startLine: number;
  isComponentLink: boolean;
  totalImpactedPages: number;
  highestSeverity: 'P0_CRITICAL' | 'P1_HIGH' | 'P2_LOW';
  impactedRoutes: RouteImpact[];
  summaryText: string;
}

const CRITICAL_KEYWORDS = ['pricing', 'signup', 'login', 'auth', 'getting-started', 'quickstart', 'checkout', 'onboarding'];
const LOW_KEYWORDS = ['changelog', 'archive', 'blog', 'legacy', 'v1', 'history', 'terms', 'privacy'];

export class BlastRadiusEngine {
  static classifyRoute(routePath: string): { severity: 'P0_CRITICAL' | 'P1_HIGH' | 'P2_LOW'; category: RouteImpact['category'] } {
    const lower = routePath.toLowerCase();

    if (CRITICAL_KEYWORDS.some(kw => lower.includes(kw)) || lower === '/' || lower === '/index') {
      const category = lower.includes('pricing') || lower.includes('checkout') ? 'Monetization' : 'Onboarding';
      return { severity: 'P0_CRITICAL', category };
    }

    if (LOW_KEYWORDS.some(kw => lower.includes(kw))) {
      return { severity: 'P2_LOW', category: 'Archive' };
    }

    return { severity: 'P1_HIGH', category: 'Core Documentation' };
  }

  /**
   * Computes the blast radius for all links across parsed repository files.
   * If a link originates in a layout/shared component, its impact expands to all routes.
   */
  static analyze(files: ParsedFile[]): ScoredBlastRadius[] {
    // 1. Discover all distinct live routes in this repository
    const allRoutes: RouteImpact[] = files
      .filter(f => !f.isLayout && f.detectedRoute)
      .map(f => {
        const route = f.detectedRoute!;
        const { severity, category } = this.classifyRoute(route);
        return { routePath: route, severity, category };
      });

    // If no distinct routes were detected, default to a root route
    if (allRoutes.length === 0) {
      allRoutes.push({ routePath: '/', severity: 'P0_CRITICAL', category: 'Onboarding' });
    }

    // 2. Map of URL -> occurrences grouped by root source file
    const linkMap: Map<string, { link: ExtractedLink; file: ParsedFile }[]> = new Map();

    for (const file of files) {
      for (const link of file.links) {
        const key = `${link.url}::${file.filePath}::${link.startLine}`;
        if (!linkMap.has(link.url)) {
          linkMap.set(link.url, []);
        }
        linkMap.get(link.url)!.push({ link, file });
      }
    }

    const results: ScoredBlastRadius[] = [];

    for (const [url, occurrences] of linkMap.entries()) {
      // Check if any occurrence is in a layout component
      const layoutOccurrence = occurrences.find(o => o.file.isLayout);
      const primary = layoutOccurrence || occurrences[0];

      let impactedRoutes: RouteImpact[] = [];
      let isComponentLink = false;

      if (layoutOccurrence) {
        // Shared component affects ALL routes mounting the layout
        isComponentLink = true;
        impactedRoutes = [...allRoutes];
      } else {
        // Affects only the individual routes where this link exists
        isComponentLink = false;
        const pageRoutes = occurrences
          .map(o => o.file.detectedRoute)
          .filter((r): r is string => Boolean(r));

        impactedRoutes = allRoutes.filter(r => pageRoutes.includes(r.routePath));
        if (impactedRoutes.length === 0 && primary.file.detectedRoute) {
          const { severity, category } = this.classifyRoute(primary.file.detectedRoute);
          impactedRoutes.push({ routePath: primary.file.detectedRoute, severity, category });
        }
      }

      // Determine highest severity
      let highestSeverity: 'P0_CRITICAL' | 'P1_HIGH' | 'P2_LOW' = 'P2_LOW';
      if (impactedRoutes.some(r => r.severity === 'P0_CRITICAL')) {
        highestSeverity = 'P0_CRITICAL';
      } else if (impactedRoutes.some(r => r.severity === 'P1_HIGH')) {
        highestSeverity = 'P1_HIGH';
      }

      const p0Count = impactedRoutes.filter(r => r.severity === 'P0_CRITICAL').length;
      const summaryText = isComponentLink
        ? `1 component string in ${primary.file.filePath}:${primary.link.startLine} collapses into ${impactedRoutes.length} live pages affected (${p0Count} critical onboarding/monetization funnels)`
        : `1 leaf page link in ${primary.file.filePath}:${primary.link.startLine} affecting route ${impactedRoutes[0]?.routePath || primary.file.filePath}`;

      results.push({
        url,
        sourceFile: primary.file.filePath,
        startLine: primary.link.startLine,
        isComponentLink,
        totalImpactedPages: impactedRoutes.length,
        highestSeverity,
        impactedRoutes,
        summaryText,
      });
    }

    return results;
  }
}
