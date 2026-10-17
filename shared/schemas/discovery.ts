import { z } from "zod";
import { categoryPageSize, categoryMaxResults } from "../constants/categories";

export function currentSeason() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Shanghai", year: "numeric", month: "numeric" }).formatToParts(new Date());
  return {
    year: parts.find((part) => part.type === "year")!.value,
    quarter: String(Math.ceil(Number(parts.find((part) => part.type === "month")!.value) / 3)),
  };
}
export const discoveryQuerySchema = z.object({
  mode: z.enum(["season", "ranking"]).default("season"),
  year: z.union([z.literal("全部"), z.string().regex(/^(?:19|20)\d{2}$/)]).default("全部"),
  quarter: z.enum(["1", "2", "3", "4"]).default(() => currentSeason().quarter as "1" | "2" | "3" | "4"),
  sort: z.enum(["heat", "score", "rank"]).default("heat"),
  page: z.string().regex(/^[1-9]\d?$/).default("1").transform(Number)
    .pipe(z.number().int().positive().max(Math.ceil(categoryMaxResults / categoryPageSize))),
}).transform((row) => ({
  ...row,
  year: row.mode === "season" && row.year === "全部" ? currentSeason().year : row.year,
  sort: row.mode === "ranking" ? "rank" as const : row.sort,
}));
export type DiscoveryQuery = z.infer<typeof discoveryQuerySchema>;

const images = z.object({
  large: z.string().nullish().transform((value) => value || ""),
  common: z.string().nullish().transform((value) => value || ""),
}).nullish().transform((value) => value || { large: "", common: "" });
const identity = { id: z.number().int().positive(), name: z.string(), images };
export const relatedSubjectsSchema = z.array(z.object({
  ...identity,
  name_cn: z.string().nullish().transform((value) => value || ""),
  type: z.number().int(), relation: z.string(),
})).max(2000);
export const relatedCharactersSchema = z.array(z.object({
  ...identity,
  relation: z.string().catch("角色"),
  actors: z.array(z.object(identity)).nullish().transform((value) => value || []),
})).max(2000);
