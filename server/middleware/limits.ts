const buckets = new Map<string, { count: number; reset: number }>();
export default defineEventHandler((event) => {
  if (!event.path.startsWith("/api/")) return;
  setHeader(event, "X-Content-Type-Options", "nosniff");
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [key, bucket] of buckets)
      if (bucket.reset < now) buckets.delete(key);
  }
  const ip = getRequestIP(event) || "unknown";
  const kind =
    event.path.startsWith("/api/danmaku/") &&
    !event.path.startsWith("/api/danmaku/status")
      ? "danmaku"
      : event.path.includes("/resources") || event.path.includes("/resolve")
        ? "source"
        : "catalog";
  const key = `${ip}:${kind}`;
  const max = kind === "danmaku" ? 30 : kind === "source" ? 120 : 180;
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    if (buckets.size >= 10000)
      throw createError({ statusCode: 503, message: "服务繁忙，请稍后重试。" });
    buckets.set(key, { count: 1, reset: now + 60_000 });
    return;
  }
  if (++bucket.count > max) {
    setHeader(event, "Retry-After", Math.ceil((bucket.reset - now) / 1000));
    throw createError({ statusCode: 429, message: "请求太频繁，请稍后重试。" });
  }
});
