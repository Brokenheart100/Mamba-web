import type { Danmaku } from "../types/media";
import { importedDanmakuSchema } from "../schemas/danmaku";

export function validateDanmaku(value: unknown): Danmaku[] {
  const result = importedDanmakuSchema.safeParse(value);
  if (result.success) return result.data;
  const index = result.error.issues[0]?.path[0];
  throw new Error(typeof index === "number"
    ? `第 ${index + 1} 条弹幕的时间或文本无效。`
    : "弹幕必须是数组，且不超过 50000 条。");
}
