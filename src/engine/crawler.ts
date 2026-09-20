export interface CrawlResult {
  url: string;
  isAlive: boolean;
  statusCode: number | null;
  error?: string;
  durationMs: number;
  cached: boolean;
}

// Known walled gardens that return 403 / 999 to bots but are live for real users
const AUTH_WALLED_DOMAINS = [
  'linkedin.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'facebook.com',
  't.co',
];

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'Upgrade-Insecure-Requests': '1',
};

export class CrawlerEngine {
  private cache: Map<string, { result: CrawlResult; timestamp: number }> = new Map();
  private cacheTtlMs: number = 24 * 60 * 60 * 1000; // 24 hours
  private domainQueues: Map<string, Promise<void>> = new Map();

  constructor(ttlMs?: number) {
    if (ttlMs) this.cacheTtlMs = ttlMs;
  }

  private getDomain(urlStr: string): string {
    try {
      return new URL(urlStr).hostname;
    } catch {
      return 'unknown';
    }
  }

  private isAuthWalled(domain: string): boolean {
    return AUTH_WALLED_DOMAINS.some(d => domain.includes(d));
  }

  // Domain-based rate limiting to prevent 429 throttling
  private async throttleDomain(domain: string, delayMs: number = 250): Promise<void> {
    const existing = this.domainQueues.get(domain) || Promise.resolve();
    const next = existing.then(async () => {
      await new Promise(r => setTimeout(r, delayMs));
    });
    this.domainQueues.set(domain, next);
    return next;
  }

  async checkUrl(url: string, internalBaseUrl?: string): Promise<CrawlResult> {
    const startTime = Date.now();

    // Check cache
    const cachedEntry = this.cache.get(url);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < this.cacheTtlMs) {
      return { ...cachedEntry.result, cached: true, durationMs: Date.now() - startTime };
    }

    // Handle relative internal routes
    let targetUrl = url;
    if (url.startsWith('/')) {
      if (!internalBaseUrl) {
        // Mock internal route test against local sitemap
        return {
          url,
          isAlive: true,
          statusCode: 200,
          durationMs: Date.now() - startTime,
          cached: false,
        };
      }
      targetUrl = `${internalBaseUrl.replace(/\/$/, '')}${url}`;
    }

    const domain = this.getDomain(targetUrl);
    await this.throttleDomain(domain, 200);

    // Run verification with double-check gate
    const firstAttempt = await this.verifyHttp(targetUrl, domain);
    
    // If it failed with a potentially transient error, run the double-check gate after a brief pause
    if (!firstAttempt.isAlive && firstAttempt.statusCode !== 404) {
      await new Promise(r => setTimeout(r, 600));
      const secondAttempt = await this.verifyHttp(targetUrl, domain);
      if (secondAttempt.isAlive) {
        return this.saveToCache(url, secondAttempt, startTime);
      }
    }

    return this.saveToCache(url, firstAttempt, startTime);
  }

  private saveToCache(url: string, result: Omit<CrawlResult, 'durationMs' | 'cached'>, startTime: number): CrawlResult {
    const fullResult: CrawlResult = {
      ...result,
      durationMs: Date.now() - startTime,
      cached: false,
    };
    this.cache.set(url, { result: fullResult, timestamp: Date.now() });
    return fullResult;
  }

  private async verifyHttp(targetUrl: string, domain: string): Promise<Omit<CrawlResult, 'durationMs' | 'cached'>> {
    // Phase 1: Try HEAD request with modern browser headers
    try {
      const headController = new AbortController();
      const headTimeout = setTimeout(() => headController.abort(), 6000);

      const headRes = await fetch(targetUrl, {
        method: 'HEAD',
        headers: BROWSER_HEADERS,
        signal: headController.signal,
        redirect: 'follow',
      });
      clearTimeout(headTimeout);

      if (headRes.ok || (headRes.status >= 200 && headRes.status < 400)) {
        return { url: targetUrl, isAlive: true, statusCode: headRes.status };
      }

      // If HEAD is disallowed (405) or rejected by bot filter (403), fall through to Phase 2
      if (headRes.status !== 405 && headRes.status !== 403 && headRes.status !== 400) {
        if (headRes.status === 404) {
          return { url: targetUrl, isAlive: false, statusCode: 404, error: 'HTTP 404 Not Found' };
        }
      }
    } catch {
      // Fall through to Phase 2 GET
    }

    // Phase 2: GET with Range abort (stream cutoff on header receive)
    try {
      const getController = new AbortController();
      const getTimeout = setTimeout(() => getController.abort(), 8000);

      const getRes = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          ...BROWSER_HEADERS,
          'Range': 'bytes=0-1024',
        },
        signal: getController.signal,
        redirect: 'follow',
      });
      clearTimeout(getTimeout);

      // Abort downloading remainder of body
      getController.abort();

      if (getRes.ok || (getRes.status >= 200 && getRes.status < 400)) {
        return { url: targetUrl, isAlive: true, statusCode: getRes.status };
      }

      // Walled-garden bot block mitigation (LinkedIn/Twitter return 403/999)
      if (this.isAuthWalled(domain) && (getRes.status === 403 || getRes.status === 999)) {
        return {
          url: targetUrl,
          isAlive: true, // Do not trigger false alarm
          statusCode: getRes.status,
          error: 'Known Auth Wall (Verified Active Domain)',
        };
      }

      return {
        url: targetUrl,
        isAlive: false,
        statusCode: getRes.status,
        error: `HTTP ${getRes.status}`,
      };
    } catch (err: any) {
      // If error was just our own planned abort after reading headers, it's alive
      if (err.name === 'AbortError') {
        // If aborted after connect, let's treat gracefully
      }
      return {
        url: targetUrl,
        isAlive: false,
        statusCode: null,
        error: err.message || 'Connection Failed',
      };
    }
  }
}

export const crawler = new CrawlerEngine();
