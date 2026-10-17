import { createApp, eventHandler, toWebHandler } from "h3";
import { RateLimiterRes } from "rate-limiter-flexible";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import middleware from "../server/middleware/limits";
import { createRequestLimiter, requestKind } from "../server/utils/request-limiter";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-16T06:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("request rate limits", () => {
  it("preserves endpoint categories and the status exemption", () => {
    expect(requestKind("/api/danmaku/search")).toBe("danmaku");
    expect(requestKind("/api/danmaku/status")).toBe("catalog");
    expect(requestKind("/api/episodes/1/resources")).toBe("source");
    expect(requestKind("/api/playback/resolve")).toBe("source");
    expect(requestKind("/api/calendar")).toBe("catalog");
  });

  it("enforces each quota under concurrent consumption without mixing IPs or categories", async () => {
    const consume = createRequestLimiter();
    for (const [kind, max] of [["danmaku", 30], ["source", 120], ["catalog", 180]] as const) {
      const results = await Promise.allSettled(Array.from({ length: max + 1 }, () => consume("ip-a", kind)));
      expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(max);
      const rejected = results.find((row) => row.status === "rejected") as PromiseRejectedResult;
      expect(rejected.reason).toBeInstanceOf(RateLimiterRes);
      await expect(consume("ip-b", kind)).resolves.toMatchObject({ remainingPoints: max - 1 });
    }
  });

  it("resets the fixed window without extending it when blocked requests arrive", async () => {
    const consume = createRequestLimiter();
    await Promise.all(Array.from({ length: 30 }, () => consume("ip-a", "danmaku")));
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(consume("ip-a", "danmaku")).rejects.toMatchObject({ msBeforeNext: 30_000 });
    await vi.advanceTimersByTimeAsync(30_001);
    await expect(consume("ip-a", "danmaku")).resolves.toMatchObject({ remainingPoints: 29 });
  });

  it("rejects new keys at capacity without evicting active counters, and reclaims expired slots", async () => {
    const consume = createRequestLimiter(2);
    await consume("ip-a", "danmaku");
    await consume("ip-b", "danmaku");
    expect(() => consume("ip-c", "danmaku")).toThrow("服务繁忙");
    await expect(consume("ip-a", "danmaku")).resolves.toMatchObject({ remainingPoints: 28 });
    await vi.advanceTimersByTimeAsync(60_001);
    await expect(consume("ip-c", "danmaku")).resolves.toMatchObject({ remainingPoints: 29 });
  });

  it("returns a real H3 429 with Retry-After while status remains available", async () => {
    const app = createApp().use(middleware).use(eventHandler(() => ({ ok: true })));
    const request = toWebHandler(app);
    for (let index = 0; index < 30; index++) {
      expect((await request(new Request("http://localhost/api/danmaku/search"))).status).toBe(200);
    }
    const rejected = await request(new Request("http://localhost/api/danmaku/search"));
    expect(rejected.status).toBe(429);
    expect(rejected.headers.get("Retry-After")).toBe("60");
    expect(rejected.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect((await rejected.json()).statusCode).toBe(429);
    expect((await request(new Request("http://localhost/api/danmaku/status"))).status).toBe(200);
    expect((await request(new Request("http://localhost/"))).status).toBe(200);
  });
});
