import { z } from "zod";

export const danmakuIdSchema = z.union([
  z.string().regex(/^[1-9]\d{0,18}$/),
  z.number().int().positive().transform(String),
]).pipe(z.string().refine((value) => BigInt(value) <= 9223372036854775807n, {
  message: "弹幕库编号无效。",
}));

export const danmakuSchema = z.object({
  id: z.string(),
  time: z.number().nonnegative(),
  text: z.string().refine((value) => !!value.trim() && value.length <= 300),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).catch("#ffffff"),
  mode: z.enum(["scroll", "top", "bottom"]).catch("scroll"),
});

export const importedDanmakuSchema = z.array(danmakuSchema.omit({ id: true }))
  .max(50_000)
  .transform((items) => items.map((item, index) => ({ id: String(index), ...item }))
    .sort((a, b) => a.time - b.time));

export const storedDanmakuSchema = z.array(danmakuSchema).max(50_000);
const title = z.string().refine((value) => !!value.trim() && value.length <= 500);
const optionalText = (length: number) => z.preprocess(
  (value) => typeof value === "string" ? value.slice(0, length) : undefined,
  z.string().optional(),
);
export const danmakuMatchSchema = z.object({
  animeId: danmakuIdSchema,
  episodeId: danmakuIdSchema,
  animeTitle: title,
  episodeTitle: title,
  episodeNumber: optionalText(40),
  seasonTitle: optionalText(200),
});

export const danmakuSearchResultSchema = z.object({
  matches: z.array(danmakuMatchSchema).max(2000),
  hasMore: z.boolean(),
});

export const danmakuSelectionSchema = z.object({
  mode: z.enum(["local", "online"]).catch("local"),
  match: danmakuMatchSchema.optional(),
});

export const onlineDanmakuResultSchema = z.object({
  episodeId: danmakuIdSchema,
  items: importedDanmakuSchema,
  fetchedAt: z.number().positive(),
  skipped: z.number().int().nonnegative().catch(0),
  truncated: z.boolean().catch(false),
});
