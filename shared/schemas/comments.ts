import { z } from "zod";

export const commentsPageSize = 20;
export const commentsMaxPages = 10_000;
export const subjectCommentsQuerySchema = z.object({
  page: z.string().regex(/^[1-9]\d{0,4}$/).default("1").transform(Number)
    .pipe(z.number().int().max(commentsMaxPages)),
});

const collectionLabels: Record<number, string> = {
  1: "想看", 2: "看过", 3: "在看", 4: "搁置", 5: "抛弃",
};
const avatar = z.string().nullish().transform((value) => {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.hostname !== "lain.bgm.tv" || url.username || url.password) return "";
    url.protocol = "https:";
    return url.href;
  } catch { return ""; }
});
export const bangumiCommentUserSchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  nickname: z.string().nullish(),
  avatar: z.object({ small: avatar, medium: avatar }).nullish(),
}).transform((user) => ({
  name: user.nickname || user.username || "Bangumi 用户",
  avatar: user.avatar?.small || user.avatar?.medium || "",
  url: `https://bgm.tv/user/${encodeURIComponent(user.username || String(user.id))}`,
}));
const subjectCommentSchema = z.object({
  id: z.number().int().positive(),
  comment: z.string().max(100_000),
  rate: z.number().int().min(0).max(10),
  type: z.number().int().min(1).max(5),
  updatedAt: z.number().int().nonnegative().max(253_402_300_799),
  user: bangumiCommentUserSchema,
}).transform((row) => ({
  id: row.id,
  content: row.comment,
  rating: row.rate,
  status: collectionLabels[row.type]!,
  updatedAt: row.updatedAt,
  user: row.user,
}));

export const subjectCommentsResponseSchema = z.object({
  data: z.array(subjectCommentSchema).max(100),
  total: z.number().int().nonnegative().safe(),
});
export type SubjectComment = z.infer<typeof subjectCommentSchema>;
export type SubjectComments = z.infer<typeof subjectCommentsResponseSchema> & { offset: number; limit: number };

const episodeCommentRawSchema = z.object({
  id: z.number().int().positive(),
  mainID: z.number().int().positive(),
  relatedID: z.number().int().nonnegative(),
  content: z.string().max(100_000),
  createdAt: z.number().int().nonnegative().max(253_402_300_799),
  state: z.number().int().nonnegative(),
  user: bangumiCommentUserSchema.nullish(),
});
// Match Bangumi's CanViewComment rules (server-private/lib/comment.ts).
const unavailableCommentStates = new Set([1, 2, 5, 6, 7]);
const mapEpisodeComment = (row: z.infer<typeof episodeCommentRawSchema>) => ({
  id: row.id, episodeId: row.mainID, relatedId: row.relatedID,
  content: unavailableCommentStates.has(row.state) ? "这条评论暂不可见。" : row.content || "（空评论）",
  createdAt: row.createdAt,
  user: row.user || { name: "Bangumi 用户", avatar: "", url: "" },
});
export const episodeCommentsResponseSchema = z.array(episodeCommentRawSchema.extend({
  replies: z.array(episodeCommentRawSchema.transform(mapEpisodeComment)).max(5000),
}).transform((row) => ({ ...mapEpisodeComment(row), replies: row.replies }))).max(20_000);
export type EpisodeComment = z.infer<typeof episodeCommentsResponseSchema>[number];
export type EpisodeComments = { data: EpisodeComment[]; total: number; offset: number; limit: number };
