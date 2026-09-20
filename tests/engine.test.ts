import { describe, it, expect } from 'bun:test';
import { resolve } from 'path';
import { AstParser } from '../src/engine/ast-parser.ts';
import { BlastRadiusEngine } from '../src/engine/blast-radius.ts';
import { RemediationEngine } from '../src/engine/remediation.ts';
import { UsageMeter } from '../src/engine/usage-meter.ts';
import { ScannerPipeline } from '../src/engine/scanner.ts';

describe('Dead Link Insurance Core Engines', () => {

  it('AST Parser: accurately extracts links, lines, and classifies layouts', () => {
    const fixturePath = resolve(process.cwd(), 'fixtures/demo-docs/components/DocsNav.tsx');
    const parsed = AstParser.parseFile(fixturePath);

    expect(parsed).not.toBeNull();
    expect(parsed!.isLayout).toBe(true);
    expect(parsed!.links.length).toBeGreaterThanOrEqual(3);

    // Verify coordinates
    const v2Link = parsed!.links.find(l => l.url === '/api/v2');
    expect(v2Link).toBeDefined();
    expect(v2Link!.startLine).toBeGreaterThan(0);
    expect(v2Link!.isComponentLink).toBe(true);
  });

  it('Blast Radius Engine: collapses layout occurrences and identifies P0 funnels', () => {
    const fixtureDir = resolve(process.cwd(), 'fixtures/demo-docs');
    const files = ScannerPipeline.collectFiles(fixtureDir).map(f => AstParser.parseFile(f, fixtureDir)!);
    
    const impacts = BlastRadiusEngine.analyze(files);
    const v2Impact = impacts.find(i => i.url === '/api/v2');

    expect(v2Impact).toBeDefined();
    expect(v2Impact!.isComponentLink).toBe(true);
    // Should affect all discovered pages in the fixture
    expect(v2Impact!.totalImpactedPages).toBeGreaterThanOrEqual(4);
    // Should be P0 because pricing/quickstart/onboarding routes are impacted
    expect(v2Impact!.highestSeverity).toBe('P0_CRITICAL');
  });

  it('Remediation Engine: calculates Levenshtein sitemap match and generates git diff', async () => {
    const liveRoutes = ['/docs/quickstart', '/pricing', '/api/v3', '/docs/onboarding'];
    const closest = RemediationEngine.findClosestRoute('/api/v2', liveRoutes);

    expect(closest).toBe('/api/v3');

    const fixturePath = resolve(process.cwd(), 'fixtures/demo-docs/components/DocsNav.tsx');
    const diff = RemediationEngine.generateDiff(fixturePath, 11, '/api/v2', closest!);

    expect(diff).toContain('- ');
    expect(diff).toContain('+ ');
    expect(diff).toContain('/api/v3');
  });

  it('Usage Meter: enforces the $29/mo "One Plan + Usage Cap" model (2,500 links)', async () => {
    const check1 = await UsageMeter.canVerify(100);
    expect(check1.allowed).toBe(true);
    expect(check1.status.monthlyLimit).toBe(2500);
    expect(check1.status.priceMonthly).toBe(29);
    expect(check1.status.maxRepositories).toBe(3);

    // Check cap calculation
    const checkCap = await UsageMeter.canVerify(3000);
    expect(checkCap.allowed).toBe(false);
  });

});
