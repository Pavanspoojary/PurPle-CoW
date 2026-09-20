import { UsageMeter } from '../src/engine/usage-meter';
import { store } from '../src/lib/store';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { status } = await UsageMeter.canVerify(0);
  const repos = Array.from(store.repositories.values());

  return res.status(200).json({
    plan: status,
    repositories: repos,
    pricingRules: {
      planName: '$29/mo Flat Plan',
      monthlyBasePrice: 29,
      includedMonthlyLinks: 2500,
      maxRepositories: 3,
      topUpOption: '$10 for +1,000 extra links',
    },
  });
}
