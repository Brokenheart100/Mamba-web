import { createError, defineEventHandler, getRequestIP, setHeader } from "h3";
import { RateLimiterRes } from "rate-limiter-flexible";
import { createRequestLimiter, requestKind } from "../utils/request-limiter";

const consume = createRequestLimiter();
export default defineEventHandler(async (event) => {
  if (!event.path.startsWith("/api/")) return;
  setHeader(event, "X-Content-Type-Options", "nosniff");
  const ip = getRequestIP(event) || "unknown";
  try {
    await consume(ip, requestKind(event.path));
  } catch (error) {
    if (!(error instanceof RateLimiterRes)) throw error;
    setHeader(event, "Retry-After", Math.max(1, Math.ceil(error.msBeforeNext / 1000)));
    throw createError({ statusCode: 429, message: "请求太频繁，请稍后重试。" });
  }
});
