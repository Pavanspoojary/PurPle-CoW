import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { AstParser, ParsedFile } from './ast-parser.ts';
import { BlastRadiusEngine, ScoredBlastRadius } from './blast-radius.ts';
import { crawler, CrawlResult } from './crawler.ts';
import { RemediationEngine, RemediationResult } from './remediation.ts';
import { UsageMeter } from './usage-meter.ts';
import { store } from '../lib/store.ts';

export interface ScanOptions {
  rootDir: string;
  repoName?: string;
  internalBaseUrl?: string;
  dryRun?: boolean;
}

export interface ScanReport {
  repoName: string;
  scannedFiles: number;
  totalLinksFound: number;
  uniqueUrlsChecked: number;
  brokenLinksDetected: number;
  incidentsCreated: number;
  p0Incidents: number;
  p1Incidents: number;
  p2Incidents: number;
  usageStatus: any;
  incidents: {
    url: string;
    sourceFile: string;
    startLine: number;
    blastRadiusCount: number;
    severity: string;
    summaryText: string;
    remediation: RemediationResult;
  }[];
}

const SUPPORTED_EXTS = ['.md', '.mdx', '.tsx', '.jsx', '.html'];
const IGNORED_DIRS = ['node_modules', '.git', '.next', 'dist', 'build', '.gemini'];

export class ScannerPipeline {
  /**
   * Recursively collect supported files
   */
  static collectFiles(dir: string): string[] {
    const results: string[] = [];

    const walk = (currentDir: string) => {
      try {
        const entries = readdirSync(currentDir);
        for (const entry of entries) {
          if (IGNORED_DIRS.includes(entry)) continue;
          const fullPath = join(currentDir, entry);
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            walk(fullPath);
          } else if (stat.isFile() && SUPPORTED_EXTS.includes(extname(entry).toLowerCase())) {
            results.push(fullPath);
          }
        }
      } catch {
        // Skip permission issues gracefully
      }
    };

    walk(dir);
    return results;
  }

  static async scan(options: ScanOptions): Promise<ScanReport> {
    const repoName = options.repoName || 'local-project';
    const repo = await store.getRepository(repoName);

    // 1. Collect and parse files
    const filePaths = this.collectFiles(options.rootDir);
    const parsedFiles: ParsedFile[] = [];

    for (const fp of filePaths) {
      const parsed = AstParser.parseFile(fp, options.rootDir);
      if (parsed) {
        parsedFiles.push(parsed);

        // Record monitored page if applicable
        if (parsed.detectedRoute) {
          const { severity } = BlastRadiusEngine.classifyRoute(parsed.detectedRoute);
          await store.recordMonitoredPage(repo.id, parsed.detectedRoute, severity);
        }
      }
    }

    // 2. Extract Blast Radius and collapse component occurrences
    const scoredImpacts = BlastRadiusEngine.analyze(parsedFiles);

    // Collect all unique live routes for internal sitemap remediation
    const liveRoutes = parsedFiles
      .map(p => p.detectedRoute)
      .filter((r): r is string => Boolean(r));

    // 3. Check Usage Cap
    const uniqueUrls = scoredImpacts.map(s => s.url);
    const { allowed, status: currentUsage } = await UsageMeter.canVerify(uniqueUrls.length);

    if (!allowed && !options.dryRun) {
      console.warn(`[Usage Cap Exceeded] Monthly limit of ${currentUsage.monthlyLimit} reached.`);
    }

    // 4. Crawl links through anti-false-alarm engine
    const crawlResults: Map<string, CrawlResult> = new Map();
    for (const target of scoredImpacts) {
      if (target.url.startsWith('/') && !options.internalBaseUrl) {
        // Internal route check against scanned route tree
        const exists = liveRoutes.includes(target.url) || 
                       liveRoutes.includes(target.url.replace(/\/$/, '')) ||
                       liveRoutes.some(r => r.startsWith(target.url));
        crawlResults.set(target.url, {
          url: target.url,
          isAlive: exists,
          statusCode: exists ? 200 : 404,
          durationMs: 1,
          cached: false,
          error: exists ? undefined : 'Internal 404 Route Not Found in Project',
        });
      } else {
        const res = await crawler.checkUrl(target.url, options.internalBaseUrl);
        crawlResults.set(target.url, res);
      }
    }

    // Record verified link count in usage meter
    if (!options.dryRun) {
      await UsageMeter.recordUsage(uniqueUrls.length);
    }

    // 5. Build Incidents with Blast Radius and Auto-Remediation
    const incidentReports: ScanReport['incidents'] = [];
    let p0Count = 0;
    let p1Count = 0;
    let p2Count = 0;

    for (const impact of scoredImpacts) {
      const crawl = crawlResults.get(impact.url);
      const isDead = crawl ? !crawl.isAlive : false;

      // Also record in database store
      const targetType = impact.url.startsWith('http') ? 'EXTERNAL_URL' : 'INTERNAL_ROUTE';
      const urlRecord = await store.getOrCreateUrlTarget(impact.url, targetType);
      urlRecord.is_alive = !isDead;
      urlRecord.status_code = crawl?.statusCode || null;

      const occRecord = await store.recordOccurrence({
        repository_id: repo.id,
        url_target_id: urlRecord.id,
        file_path: impact.sourceFile,
        start_line: impact.startLine,
        end_line: impact.startLine,
        is_layout: impact.isComponentLink,
      });

      // Link to impacted pages
      for (const route of impact.impactedRoutes) {
        const page = await store.recordMonitoredPage(repo.id, route.routePath, route.severity);
        await store.linkPageOccurrence(occRecord.id, page.id);
      }

      if (isDead) {
        if (impact.highestSeverity === 'P0_CRITICAL') p0Count++;
        else if (impact.highestSeverity === 'P1_HIGH') p1Count++;
        else p2Count++;

        // Run auto-remediation
        const remediation = await RemediationEngine.resolve(
          impact.url,
          impact.sourceFile,
          impact.startLine,
          impact.totalImpactedPages,
          liveRoutes
        );

        if (!options.dryRun) {
          await store.recordIncident({
            repository_id: repo.id,
            url_target_id: urlRecord.id,
            severity: impact.highestSeverity,
            blast_radius_count: impact.totalImpactedPages,
            remediation_type: remediation.type,
            remediation_suggestion: remediation.suggestedUrl,
            remediation_diff: remediation.diff,
            status: 'OPEN',
          });
        }

        incidentReports.push({
          url: impact.url,
          sourceFile: impact.sourceFile,
          startLine: impact.startLine,
          blastRadiusCount: impact.totalImpactedPages,
          severity: impact.highestSeverity,
          summaryText: impact.summaryText,
          remediation,
        });
      }
    }

    const { status: finalUsage } = await UsageMeter.canVerify(0);

    return {
      repoName,
      scannedFiles: parsedFiles.length,
      totalLinksFound: parsedFiles.reduce((acc, f) => acc + f.links.length, 0),
      uniqueUrlsChecked: uniqueUrls.length,
      brokenLinksDetected: incidentReports.length,
      incidentsCreated: incidentReports.length,
      p0Incidents: p0Count,
      p1Incidents: p1Count,
      p2Incidents: p2Count,
      usageStatus: finalUsage,
      incidents: incidentReports,
    };
  }
}
