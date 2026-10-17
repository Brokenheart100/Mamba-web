import type { DanmakuMatch } from "../types/online-danmaku";
import { danmakuIdSchema, danmakuMatchSchema } from "../schemas/danmaku";

export const onlineDanmakuMaxAge = 6 * 60 * 60 * 1000;
export function danmakuId(value: unknown): string {
  const parsed = danmakuIdSchema.safeParse(value);
  if (!parsed.success) throw new Error("弹幕库编号无效。");
  return parsed.data;
}
export function validateDanmakuMatch(value: unknown): DanmakuMatch {
  const parsed = danmakuMatchSchema.safeParse(value);
  if (!parsed.success) throw new Error("弹幕匹配信息无效。");
  return parsed.data;
}
