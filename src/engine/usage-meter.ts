import { store } from '../lib/store';

export interface PlanStatus {
  planName: string;
  priceMonthly: number;
  monthlyLimit: number;
  currentUsage: number;
  remainingLinks: number;
  percentageUsed: number;
  status: 'HEALTHY' | 'APPROACHING_LIMIT' | 'CAP_REACHED';
  activeRepositories: number;
  maxRepositories: number;
}

export class UsageMeter {
  static readonly PLAN_NAME = '$29/mo Flat Plan';
  static readonly MONTHLY_PRICE = 29;
  static readonly DEFAULT_LINK_CAP = 2500;
  static readonly MAX_REPOSITORIES = 3;

  /**
   * Check if a batch crawl operation is allowed under the current usage cap
   */
  static async canVerify(linksCount: number = 1): Promise<{ allowed: boolean; status: PlanStatus }> {
    const usage = await store.getUsage();
    const activeRepos = store.repositories.size;
    
    const projected = usage.current_usage + linksCount;
    const allowed = projected <= usage.monthly_limit;
    
    const percentageUsed = Math.min(100, Math.round((usage.current_usage / usage.monthly_limit) * 100));
    let status: PlanStatus['status'] = 'HEALTHY';
    if (usage.current_usage >= usage.monthly_limit) {
      status = 'CAP_REACHED';
    } else if (percentageUsed >= 80) {
      status = 'APPROACHING_LIMIT';
    }

    const planStatus: PlanStatus = {
      planName: usage.plan_name,
      priceMonthly: this.MONTHLY_PRICE,
      monthlyLimit: usage.monthly_limit,
      currentUsage: usage.current_usage,
      remainingLinks: Math.max(0, usage.monthly_limit - usage.current_usage),
      percentageUsed,
      status,
      activeRepositories: activeRepos,
      maxRepositories: usage.max_repositories,
    };

    return { allowed, status: planStatus };
  }

  /**
   * Record link verifications against the cap
   */
  static async recordUsage(linksCount: number): Promise<PlanStatus> {
    await store.incrementUsage(linksCount);
    const { status } = await this.canVerify(0);
    return status;
  }
}
