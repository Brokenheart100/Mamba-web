import { createError } from "h3";
import { LRUCache } from "lru-cache";
import { RateLimiterMemory } from "rate-limiter-flexible";

const points = { danmaku: 30, source: 120, catalog: 180 } as const;
export type RequestKind = keyof typeof points;

export function requestKind(path: string): RequestKind {
  return path.startsWith("/api/danmaku/") && !path.startsWith("/api/danmaku/status")
    ? "danmaku"
    : path.includes("/resources") || path.includes("/resolve")
      ? "source"
      : "catalog";
}

export function createRequestLimiter(maxKeys = 10_000) {
  const limiters = {
    danmaku: new RateLimiterMemory({ points: points.danmaku, duration: 60 }),
    source: new RateLimiterMemory({ points: points.source, duration: 60 }),
    catalog: new RateLimiterMemory({ points: points.catalog, duration: 60 }),
  };
  // Admission control retains the old bound without evicting active counters.
  // Counter updates and fixed-window expiry belong to RateLimiterMemory.
  const activeKeys = new LRUCache<string, true>({
    max: maxKeys,
    ttl: 60_000,
    ttlAutopurge: true,
    ttlResolution: 0,
    // Align admission expiry with the limiter's Date-based fixed windows.
    perf: { now: () => Date.now() },
  });
  return (ip: string, kind: RequestKind) => {
    const key = `${kind}:${ip}`;
    if (!activeKeys.has(key)) {
      if (activeKeys.size >= maxKeys) activeKeys.purgeStale();
      if (activeKeys.size >= maxKeys)
        throw createError({ statusCode: 503, message: "服务繁忙，请稍后重试。" });
      activeKeys.set(key, true);
    }
    return limiters[kind].consume(ip);
  };
}
