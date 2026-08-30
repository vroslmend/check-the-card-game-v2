export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
  firstRejection: boolean;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
  rejectionReported: boolean;
}

/**
 * Small in-memory limiter for this single-process server. Keys are pruned
 * after their window expires so a stream of one-off clients cannot leave an
 * ever-growing address map behind.
 */
export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
  ) {}

  consume(key: string, now = Date.now()): RateLimitResult {
    let entry = this.entries.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + this.windowMs,
        rejectionReported: false,
      };
      this.entries.set(key, entry);
    }

    if (entry.count >= this.limit) {
      const firstRejection = !entry.rejectionReported;
      entry.rejectionReported = true;
      return {
        allowed: false,
        retryAfterMs: Math.max(0, entry.resetAt - now),
        firstRejection,
      };
    }

    entry.count += 1;
    return {
      allowed: true,
      retryAfterMs: Math.max(0, entry.resetAt - now),
      firstRejection: false,
    };
  }

  prune(now = Date.now()): void {
    for (const [key, entry] of this.entries) {
      if (now >= entry.resetAt) this.entries.delete(key);
    }
  }
}
