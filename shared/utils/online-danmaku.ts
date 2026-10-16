import type { DanmakuMatch } from "../types/online-danmaku";

export const onlineDanmakuMaxAge = 6 * 60 * 60 * 1000;
export function danmakuId(value: unknown): string {
  if (typeof value === "number" && !Number.isSafeInteger(value))
    throw new Error("弹幕库编号无效。");
  if (typeof value !== "string" && typeof value !== "number")
    throw new Error("弹幕库编号无效。");
  const text = String(value);
  if (!/^[1-9]\d{0,18}$/.test(text) || BigInt(text) > 9223372036854775807n)
    throw new Error("弹幕库编号无效。");
  return text;
}
export function validateDanmakuMatch(value: unknown): DanmakuMatch {
  if (!value || typeof value !== "object")
    throw new Error("弹幕匹配信息无效。");
  const row = value as Record<string, unknown>;
  const title = (value: unknown) => {
    if (typeof value !== "string" || !value.trim() || value.length > 500)
      throw new Error("弹幕匹配标题无效。");
    return value;
  };
  return {
    animeId: danmakuId(row.animeId),
    episodeId: danmakuId(row.episodeId),
    animeTitle: title(row.animeTitle),
    episodeTitle: title(row.episodeTitle),
    ...(typeof row.episodeNumber === "string"
      ? { episodeNumber: row.episodeNumber.slice(0, 40) }
      : {}),
    ...(typeof row.seasonTitle === "string"
      ? { seasonTitle: row.seasonTitle.slice(0, 200) }
      : {}),
  };
}
