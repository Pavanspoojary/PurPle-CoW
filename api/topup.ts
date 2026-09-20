export const config = {
  runtime: 'edge',
};

let currentLimit = 2500;

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

  currentLimit += 1000;

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Purchased 1,000 link verification top-up ($10 billed).',
      status: {
        planName: '$29/mo Flat Plan',
        priceMonthly: 29,
        monthlyLimit: currentLimit,
        currentUsage: 640,
        remainingLinks: currentLimit - 640,
        percentageUsed: Math.round((640 / currentLimit) * 100),
        status: 'HEALTHY',
        activeRepositories: 1,
        maxRepositories: 3,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
