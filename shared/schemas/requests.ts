import { z } from "zod";
import { danmakuIdSchema } from "./danmaku";

export const routeIdSchema = z.string().regex(/^\d{1,10}$/)
  .transform(Number).pipe(z.number().int().positive());
export const subjectSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  offset: z.string().regex(/^\d+$/).default("0")
    .transform(Number).pipe(z.number().int().min(0).max(1000)),
});
export const danmakuSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  episode: z.string().trim().regex(/^(?:[1-9]\d{0,4}|[CSO][1-9]\d{0,3})?$/).default(""),
});
export const danmakuMatchQuerySchema = z.object({
  subjectId: z.string().regex(/^[1-9]\d{0,9}$/)
    .transform(Number).pipe(z.number().int().positive().max(2147483647)),
});
export const danmakuParamsSchema = z.object({ id: danmakuIdSchema });
export const playbackBodySchema = z.object({ resourceId: z.string().min(1).max(4096) });
