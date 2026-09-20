import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { store } from './lib/store';
import { ScannerPipeline } from './engine/scanner';
import { UsageMeter } from './engine/usage-meter';

import * as dotenv from 'dotenv';

// Load both .env and .env.local
dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = resolve(import.meta.dir, 'public');

// Initialize with a demo scan on startup so the dashboard immediately renders live data
async function initializeDemoData() {
  const fixtureDir = resolve(process.cwd(), 'fixtures/demo-docs');
  if (existsSync(fixtureDir)) {
    console.log('[System] Initializing fixture data for instant dashboard preview...');
    try {
      await ScannerPipeline.scan({
        rootDir: fixtureDir,
        repoName: 'acme/developer-portal',
        dryRun: false,
      });
      console.log('[System] Fixture data initialized successfully.');
    } catch (e) {
      console.error('[System] Failed to initialize fixture data:', e);
    }
  }
}

export async function appHandler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // 1. API: Plan & Usage Status ("One Plan + Usage Cap")
  if (url.pathname === '/api/status' && req.method === 'GET') {
    const { status } = await UsageMeter.canVerify(0);
    const repos = Array.from(store.repositories.values());
    return new Response(
      JSON.stringify({
        plan: status,
        repositories: repos,
        pricingRules: {
          planName: '$29/mo Flat Plan',
          monthlyBasePrice: 29,
          includedMonthlyLinks: 2500,
          maxRepositories: 3,
          topUpOption: '$10 for +1,000 extra links',
        },
      }),
      { headers }
    );
  }

  // 2. API: Get Actionable Incidents with Blast Radius
  if (url.pathname === '/api/incidents' && req.method === 'GET') {
    const incidents = await store.getIncidents();
    return new Response(JSON.stringify(incidents), { headers });
  }

  // 3. API: Trigger Scan
  if (url.pathname === '/api/scan' && req.method === 'POST') {
    const fixtureDir = resolve(process.cwd(), 'fixtures/demo-docs');
    const report = await ScannerPipeline.scan({
      rootDir: fixtureDir,
      repoName: 'acme/developer-portal',
      dryRun: false,
    });
    return new Response(JSON.stringify(report), { headers });
  }

  // 4. API: Usage Top-Up Simulation ($10 for +1,000 links)
  if (url.pathname === '/api/topup' && req.method === 'POST') {
    store.usage.monthly_limit += 1000;
    const { status } = await UsageMeter.canVerify(0);
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Purchased 1,000 link verification top-up ($10 billed).',
        status,
      }),
      { headers }
    );
  }

  // 5. API: Clerk Config
  if (url.pathname === '/api/clerk-config' && req.method === 'GET') {
    const publishableKey =
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
      process.env.CLERK_PUBLISHABLE_KEY ||
      '';
    return new Response(JSON.stringify({ publishableKey }), { headers });
  }

  // 6. Serve Static Frontend
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const indexPath = join(PUBLIC_DIR, 'index.html');
    if (existsSync(indexPath)) {
      return new Response(readFileSync(indexPath), {
        headers: { 'Content-Type': 'text/html' },
      });
    }
  }

  return new Response('Not Found', { status: 404 });
}

// Start Bun native server
const server = Bun.serve({
  port: PORT,
  fetch: appHandler,
});

console.log(`\n🚀 Dead Link Insurance Server running at http://localhost:${PORT}`);
console.log(`📦 Model: "One Plan + Usage Cap" ($29/mo, 2,500 links cap, 3 repos)`);

// Kick off fixture bootstrap asynchronously
initializeDemoData();
