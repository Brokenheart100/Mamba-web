import type { H3Event } from "h3";

export function routeId(event: H3Event): number {
  const raw = getRouterParam(event, "id") || "";
  if (!/^\d{1,10}$/.test(raw) || Number(raw) <= 0)
    throw createError({ statusCode: 400, message: "条目 ID 无效。" });
  return Number(raw);
}
