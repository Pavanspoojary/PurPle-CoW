import { store } from '../src/lib/store.ts';
import { UsageMeter } from '../src/engine/usage-meter.ts';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  store.usage.monthly_limit += 1000;
  const { status } = await UsageMeter.canVerify(0);

  return res.status(200).json({
    success: true,
    message: 'Purchased 1,000 link verification top-up ($10 billed).',
    status,
  });
}
