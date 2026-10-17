import { z } from "zod";
import { categoryFormats, categoryGenres, categoryRegions, categoryMaxResults, categoryPageSize } from "../constants/categories";

export const categoryQuerySchema = z.object({
  region: z.enum(categoryRegions).default("全部"),
  format: z.enum(categoryFormats).default("全部"),
  genre: z.enum(categoryGenres).default("全部"),
  year: z.union([
    z.literal("全部"),
    z.literal("2000以前"),
    z.string().regex(/^(?:19|20)\d{2}$/),
  ]).default("全部"),
  sort: z.enum(["heat", "score", "rank"]).default("heat"),
  page: z.string().regex(/^[1-9]\d?$/).default("1")
    .transform(Number).pipe(z.number().int().min(1).max(Math.ceil(categoryMaxResults / categoryPageSize))),
});
export type CategoryQuery = z.infer<typeof categoryQuerySchema>;
