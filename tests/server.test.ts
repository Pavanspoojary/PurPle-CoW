import { describe, it, expect } from 'bun:test';
import { appHandler } from '../src/server';

describe('Dead Link Insurance HTTP Server API', () => {
  it('serves /api/status with One Plan + Usage Cap metrics', async () => {
    const req = new Request('http://localhost/api/status');
    const res = await appHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    
    expect(data.plan).toBeDefined();
    expect(data.plan.planName).toBe('$29/mo Flat Plan');
    expect(data.plan.priceMonthly).toBe(29);
    expect(data.plan.monthlyLimit).toBe(2500);
    expect(data.plan.maxRepositories).toBe(3);
    expect(data.pricingRules.topUpOption).toBe('$10 for +1,000 extra links');
  });

  it('serves /api/incidents with collapsed blast radius', async () => {
    // Run scan to populate incidents
    await appHandler(new Request('http://localhost/api/scan', { method: 'POST' }));

    const req = new Request('http://localhost/api/incidents');
    const res = await appHandler(req);
    expect(res.status).toBe(200);
    const incidents = await res.json() as any[];
    
    expect(Array.isArray(incidents)).toBe(true);
    expect(incidents.length).toBeGreaterThanOrEqual(1);

    const p0 = incidents.find(i => i.severity === 'P0_CRITICAL');
    expect(p0).toBeDefined();
    expect(p0.blast_radius_count).toBeGreaterThanOrEqual(3);
    expect(p0.remediation_diff).toContain('+ ');
  });

  it('serves / (index.html landing page)', async () => {
    const req = new Request('http://localhost/');
    const res = await appHandler(req);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Dead Link Insurance');
    expect(html).toContain('$29');
    expect(html).toContain('Blast Radius');
  });

  it('handles /api/topup to increase cap by 1,000 links', async () => {
    const req = new Request('http://localhost/api/topup', { method: 'POST' });
    const res = await appHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.status.monthlyLimit).toBeGreaterThanOrEqual(3500);
  });
});
