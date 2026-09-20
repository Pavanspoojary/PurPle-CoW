import { resolve } from 'path';
import { ScannerPipeline } from '../src/engine/scanner';

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const fixtureDir = resolve(process.cwd(), 'fixtures/demo-docs');
    const report = await ScannerPipeline.scan({
      rootDir: fixtureDir,
      repoName: 'acme/developer-portal',
      dryRun: false,
    });
    return res.status(200).json(report);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
