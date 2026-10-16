import type { Danmaku } from "../types/media";

export function validateDanmaku(value: unknown): Danmaku[] {
  if (!Array.isArray(value) || value.length > 50000)
    throw new Error("弹幕必须是数组，且不超过 50000 条。");
  return value
    .map<Danmaku>((item, index) => {
      if (!item || typeof item !== "object")
        throw new Error("弹幕格式不正确。");
      const row = item as Record<string, unknown>;
      if (
        typeof row.time !== "number" ||
        !Number.isFinite(row.time) ||
        row.time < 0 ||
        typeof row.text !== "string" ||
        !row.text.trim() ||
        row.text.length > 300
      )
        throw new Error(`第 ${index + 1} 条弹幕的时间或文本无效。`);
      return {
        id: String(index),
        time: row.time,
        text: row.text,
        color:
          typeof row.color === "string" && /^#[0-9a-f]{6}$/i.test(row.color)
            ? row.color
            : "#ffffff",
        mode: row.mode === "top" || row.mode === "bottom" ? row.mode : "scroll",
      };
    })
    .sort((a, b) => a.time - b.time);
}
