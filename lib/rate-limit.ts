/**
 * Lightweight in-memory rate limiter for Next.js Edge Middleware.
 *
 * Note: In a distributed edge environment, this is per-instance.
 * For global rate limiting, a distributed store like Redis would be required.
 */

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const trackers = new Map<string, { count: number; expires: number }>();

/**
 * Checks if a request from a given IP should be rate limited.
 *
 * @param ip The IP address to track
 * @param limit Maximum number of requests allowed in the window
 * @param windowMs Time window in milliseconds
 * @returns RateLimitResult
 */
export function rateLimit(
  ip: string,
  limit: number = 60,
  windowMs: number = 60000
): RateLimitResult {
  const now = Date.now();
  const tracker = trackers.get(ip);

  // Periodic cleanup of the map to prevent memory leaks.
  // We perform a partial cleanup if the map grows too large.
  if (trackers.size > 2000) {
    let cleaned = 0;
    for (const [key, value] of trackers.entries()) {
      if (now > value.expires) {
        trackers.delete(key);
        cleaned++;
      }
      // Stop cleaning after some work to avoid blocking the request for too long
      if (cleaned > 500) break;
    }
  }

  if (!tracker || now > tracker.expires) {
    const expires = now + windowMs;
    trackers.set(ip, { count: 1, expires });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: expires,
    };
  }

  tracker.count++;

  if (tracker.count > limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: tracker.expires,
    };
  }

  return {
    success: true,
    limit,
    remaining: limit - tracker.count,
    reset: tracker.expires,
  };
}
