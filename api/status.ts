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

  const payload = {
    plan: {
      planName: '$29/mo Flat Plan',
      priceMonthly: 29,
      monthlyLimit: 2500,
      currentUsage: 640,
      remainingLinks: 1860,
      percentageUsed: 26,
      status: 'HEALTHY',
      activeRepositories: 1,
      maxRepositories: 3,
    },
    repositories: [
      {
        id: 'repo-1',
        organization_id: 'default-org',
        full_name: 'acme/developer-portal',
        default_branch: 'main',
        sitemap_url: 'https://docs.acme.com/sitemap.xml',
      },
    ],
    pricingRules: {
      planName: '$29/mo Flat Plan',
      monthlyBasePrice: 29,
      includedMonthlyLinks: 2500,
      maxRepositories: 3,
      topUpOption: '$10 for +1,000 extra links',
    },
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
