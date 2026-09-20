export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const report = {
    repoName: 'acme/developer-portal',
    scannedFiles: 6,
    totalLinksFound: 12,
    uniqueUrlsChecked: 6,
    brokenLinksDetected: 2,
    incidentsCreated: 2,
    p0Incidents: 2,
    p1Incidents: 0,
    p2Incidents: 0,
    usageStatus: {
      planName: '$29/mo Flat Plan',
      monthlyLimit: 2500,
      currentUsage: 640,
      percentageUsed: 26,
      status: 'HEALTHY',
    },
    incidents: [
      {
        url: '/api/v2',
        sourceFile: 'components/DocsNav.tsx',
        startLine: 12,
        blastRadiusCount: 5,
        severity: 'P0_CRITICAL',
        summaryText:
          '1 component string in components/DocsNav.tsx:12 collapses into 5 live pages affected (3 critical onboarding/monetization funnels)',
        remediation: {
          type: 'SITEMAP_MATCH',
          suggestedUrl: '/docs/api-v3',
          pullRequestTitle:
            'fix(links): repair broken internal route /api/v2 (affects 5 pages)',
        },
      },
    ],
  };

  return new Response(JSON.stringify(report), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
