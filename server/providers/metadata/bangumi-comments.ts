import { commentsPageSize, subjectCommentsResponseSchema, episodeCommentsResponseSchema } from "#shared/schemas/comments";
import type { EpisodeComment, EpisodeComments, SubjectComments } from "#shared/schemas/comments";

async function requestComments(path: string, query?: Record<string, number>): Promise<unknown> {
  try {
    return await $fetch<unknown>(path, {
      baseURL: "https://next.bgm.tv", query,
      timeout: 12_000, retry: 0,
      headers: { "User-Agent": "Mamba-Animation/0.1 (Nuxt; local-first anime catalog)", Accept: "application/json" },
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    throw createError({
      statusCode: status === 404 ? 404 : status === 401 || status === 403 || status === 429 ? 503 : 502,
      message: status === 401 || status === 403
        ? "Bangumi 评论暂时无法匿名读取，可前往原页查看。"
        : "评论暂时无法连接，请稍后重试或前往 Bangumi 查看。",
    });
  }
}

// Bangumi's new-site API is separate from the stable public /v0 API.
// This adapter reads anonymous comments only; never forward cookies or tokens.
export const getSubjectComments = defineCachedFunction(
  async (subjectId: number, page: number): Promise<SubjectComments> => {
    const offset = (page - 1) * commentsPageSize;
    const response = await requestComments(`/p1/subjects/${subjectId}/comments`, { limit: commentsPageSize, offset });
    const parsed = subjectCommentsResponseSchema.safeParse(response);
    if (!parsed.success) throw createError({ statusCode: 502, message: "评论资料暂时无法读取，可前往 Bangumi 查看。" });
    return { ...parsed.data, offset, limit: commentsPageSize };
  },
  { name: "bgm-subject-comments-v1", maxAge: 300, swr: true },
);

// The official episode endpoint returns the complete thread array, without
// limit/offset parameters. Cache once per episode, then page the root comments.
const getEpisodeThreads = defineCachedFunction(
  async (episodeId: number): Promise<EpisodeComment[]> => {
    const parsed = episodeCommentsResponseSchema.safeParse(await requestComments(`/p1/episodes/${episodeId}/comments`));
    if (!parsed.success || parsed.data.some((row) => row.episodeId !== episodeId || row.replies.some((reply) => reply.episodeId !== episodeId))) {
      throw createError({ statusCode: 502, message: "本集讨论资料暂时无法读取，可前往 Bangumi 查看。" });
    }
    return parsed.data;
  },
  { name: "bgm-episode-comments-v1", maxAge: 300, swr: true },
);
export async function getEpisodeComments(episodeId: number, page: number): Promise<EpisodeComments> {
  const rows = await getEpisodeThreads(episodeId);
  const offset = (page - 1) * commentsPageSize;
  return { data: rows.slice(offset, offset + commentsPageSize), total: rows.length, offset, limit: commentsPageSize };
}
