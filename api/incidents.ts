export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const incidents = [
    {
      id: 'inc-1',
      repository_id: 'repo-1',
      url: '/api/v2',
      file_path: 'components/DocsNav.tsx',
      start_line: 12,
      severity: 'P0_CRITICAL',
      blast_radius_count: 5,
      impacted_pages: [
        '/pricing',
        '/docs/quickstart',
        '/docs/onboarding',
        '/docs/api-v3',
        '/changelog',
      ],
      remediation_type: 'SITEMAP_MATCH',
      remediation_suggestion: '/docs/api-v3',
      remediation_diff:
        '--- a/components/DocsNav.tsx\n+++ b/components/DocsNav.tsx\n@@ -12,1 +12,1 @@\n- <li><a href="/api/v2">REST API v2 Reference</a></li>\n+ <li><a href="/docs/api-v3">REST API v2 Reference</a></li>',
      pull_request_url: 'https://github.com/acme/developer-portal/pull/104',
      status: 'OPEN',
      created_at: new Date().toISOString(),
    },
    {
      id: 'inc-2',
      repository_id: 'repo-1',
      url: 'https://example-dead-domain-never-exists-987654321.org/spec',
      file_path: 'components/DocsNav.tsx',
      start_line: 13,
      severity: 'P0_CRITICAL',
      blast_radius_count: 5,
      impacted_pages: [
        '/pricing',
        '/docs/quickstart',
        '/docs/onboarding',
        '/docs/api-v3',
        '/changelog',
      ],
      remediation_type: 'WAYBACK_REDIRECT',
      remediation_suggestion:
        'https://web.archive.org/web/20240101000000/https://example-dead-domain-never-exists-987654321.org/spec',
      remediation_diff:
        '--- a/components/DocsNav.tsx\n+++ b/components/DocsNav.tsx\n@@ -13,1 +13,1 @@\n- <li><a href="https://example-dead-domain-never-exists-987654321.org/spec">Third-Party Protocol Spec</a></li>\n+ <li><a href="https://web.archive.org/web/20240101000000/https://example-dead-domain-never-exists-987654321.org/spec">Third-Party Protocol Spec (Archived Mirror)</a></li>',
      pull_request_url: 'https://github.com/acme/developer-portal/pull/105',
      status: 'OPEN',
      created_at: new Date().toISOString(),
    },
  ];

  return new Response(JSON.stringify(incidents), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
