import { createError, getRouterParam, type H3Event } from "h3";
import { routeIdSchema } from "#shared/schemas/requests";

export function routeId(event: H3Event): number {
  const parsed = routeIdSchema.safeParse(getRouterParam(event, "id"));
  if (!parsed.success)
    throw createError({ statusCode: 400, message: "条目 ID 无效。" });
  return parsed.data;
}
