import type {
  CalendarDay,
  Episode,
  SearchResult,
  Subject,
  RelatedSubject,
  SubjectCharacter,
} from "#shared/types/media";
import { relatedSubjectsSchema, relatedCharactersSchema } from "#shared/schemas/discovery";
import type { DiscoveryQuery } from "#shared/schemas/discovery";
import type { CategoryQuery } from "#shared/schemas/categories";
import { categoryPageSize, categoryRegionTags } from "#shared/constants/categories";

interface BgmSubject {
  id: number;
  name?: string;
  name_cn?: string;
  summary?: string;
  date?: string;
  air_date?: string;
  platform?: string;
  eps?: number;
  total_episodes?: number;
  images?: { large?: string; common?: string };
  rating?: { score?: number; rank?: number; total?: number };
  rank?: number;
  tags?: { name: string }[];
}
interface BgmEpisode {
  id: number;
  name: string;
  name_cn: string;
  sort: number;
  type: number;
  airdate: string;
  duration: string;
  subject_id?: number;
}

function mapSubject(row: BgmSubject): Subject {
  return {
    id: row.id,
    name: row.name_cn || row.name || "未命名番剧",
    originalName: row.name || "",
    image: (row.images?.large || row.images?.common || "").replace(
      /^http:/,
      "https:",
    ),
    summary: row.summary || "",
    score: row.rating?.score || 0,
    ratingCount: row.rating?.total || 0,
    rank: row.rating?.rank || row.rank || 0,
    date: row.date || row.air_date || "",
    platform: row.platform || "TV",
    episodes: row.eps || row.total_episodes || 0,
    tags: (row.tags || []).slice(0, 8).map((t) => t.name),
  };
}

async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
  } = {},
): Promise<T> {
  try {
    return await $fetch<T>(path, {
      baseURL: "https://api.bgm.tv",
      ...options,
      timeout: 12_000,
      retry: 0,
      headers: {
        "User-Agent": "Mamba-Animation/0.1 (Nuxt; local-first anime catalog)",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }) as T;
  } catch (error) {
    const code = (error as { status?: number }).status;
    throw createError({
      statusCode: code === 404 ? 404 : 502,
      message:
        code === 404
          ? "没有找到这部番剧或章节。"
          : "番剧资料暂时无法连接，请稍后重试。",
    });
  }
}

export const getCalendar = defineCachedFunction(
  async (): Promise<CalendarDay[]> => {
    const days =
      await request<
        { weekday: { id: number; cn: string }; items: BgmSubject[] }[]
      >("/calendar");
    return days.map((day) => ({
      id: day.weekday.id,
      name: day.weekday.cn,
      subjects: day.items.map(mapSubject).sort((a, b) => b.score - a.score),
    }));
  },
  { name: "bgm-calendar-v2", maxAge: 900, swr: true },
);

export const getSubject = defineCachedFunction(
  async (id: number): Promise<Subject> =>
    mapSubject(await request<BgmSubject>(`/v0/subjects/${id}`)),
  { name: "bgm-subject-v2", maxAge: 3600, swr: true },
);

export const getEpisodes = defineCachedFunction(
  async (subjectId: number): Promise<Episode[]> => {
    const data: BgmEpisode[] = [];
    let offset = 0;
    // Complete paginated responses, with a defensive upper bound.
    for (let page = 0; page < 25; page++) {
      const result = await request<{ data: BgmEpisode[]; total: number }>(
        "/v0/episodes",
        { query: { subject_id: subjectId, limit: 200, offset } },
      );
      data.push(...result.data);
      offset += result.data.length;
      if (!result.data.length || offset >= result.total) break;
      if (page === 24)
        throw createError({
          statusCode: 422,
          message: "此条目的章节数量超过当前支持范围。",
        });
    }
    return data
      .map((row) => ({
        id: row.id,
        subjectId,
        name: row.name_cn || row.name || `第 ${row.sort} 集`,
        sort: row.sort,
        type: row.type,
        airdate: row.airdate || "",
        duration: row.duration || "",
      }))
      .sort((a, b) => a.type - b.type || a.sort - b.sort);
  },
  { name: "bgm-episodes", maxAge: 900, swr: true },
);

export const getEpisode = defineCachedFunction(
  async (id: number): Promise<Episode> => {
    const row = await request<BgmEpisode>(`/v0/episodes/${id}`);
    return {
      id: row.id,
      subjectId: row.subject_id!,
      name: row.name_cn || row.name || `第 ${row.sort} 集`,
      sort: row.sort,
      type: row.type,
      airdate: row.airdate || "",
      duration: row.duration || "",
    };
  },
  { name: "bgm-episode", maxAge: 900, swr: true },
);

export const searchSubjects = defineCachedFunction(
  async (keyword: string, offset: number): Promise<SearchResult> => {
    const result = await request<{ data: BgmSubject[]; total: number }>(
      "/v0/search/subjects",
      {
        method: "POST",
        body: { keyword, sort: "match", filter: { type: [2] } },
        query: { limit: categoryPageSize, offset },
      },
    );
    return {
      data: result.data.map(mapSubject),
      total: result.total,
      offset,
      limit: categoryPageSize,
    };
  },
  { name: "bgm-search", maxAge: 300, swr: true },
);

export const browseAnime = defineCachedFunction(
  async (filters: CategoryQuery): Promise<SearchResult> => {
    const tag = [
      categoryRegionTags[filters.region],
      filters.format === "全部" ? "" : filters.format,
      filters.genre === "全部" ? "" : filters.genre,
    ].filter(Boolean);
    const airDate = filters.year === "全部" ? undefined
      : filters.year === "2000以前" ? ["<2000-01-01"]
        : [`>=${filters.year}-01-01`, `<${Number(filters.year) + 1}-01-01`];
    const offset = (filters.page - 1) * categoryPageSize;
    const result = await request<{ data: BgmSubject[]; total: number }>(
      "/v0/search/subjects",
      {
        method: "POST",
        body: {
          keyword: "",
          sort: filters.sort,
          filter: { type: [2], ...(tag.length ? { tag } : {}), ...(airDate ? { air_date: airDate } : {}) },
        },
        query: { limit: categoryPageSize, offset },
      },
    );
    return { data: result.data.map(mapSubject), total: result.total, offset, limit: categoryPageSize };
  },
  { name: "bgm-anime-categories-v1", maxAge: 300, swr: true },
);

export const getRelatedSubjects = defineCachedFunction(
  async (id: number): Promise<RelatedSubject[]> => {
    const parsed = relatedSubjectsSchema.safeParse(await request<unknown>(`/v0/subjects/${id}/subjects`));
    if (!parsed.success) throw createError({ statusCode: 502, message: "关联作品资料暂时无法读取。" });
    const labels: Record<number, string> = { 1: "书籍", 2: "动画", 3: "音乐", 4: "游戏", 6: "三次元" };
    return parsed.data.map((row) => ({
      type: row.type, relation: row.relation,
      subject: mapSubject({ ...row, platform: labels[row.type] || "其他" }),
    }));
  },
  { name: "bgm-related-subjects-v1", maxAge: 3600, swr: true },
);

export const getSubjectCharacters = defineCachedFunction(
  async (id: number): Promise<SubjectCharacter[]> => {
    const parsed = relatedCharactersSchema.safeParse(await request<unknown>(`/v0/subjects/${id}/characters`));
    if (!parsed.success) throw createError({ statusCode: 502, message: "角色与声优资料暂时无法读取。" });
    return parsed.data.map((row) => ({
      id: row.id, name: row.name, relation: row.relation,
      image: (row.images.large || row.images.common).replace(/^http:/, "https:"),
      actors: row.actors.map((actor) => ({
        id: actor.id, name: actor.name, image: (actor.images.large || actor.images.common).replace(/^http:/, "https:"),
      })),
    }));
  },
  { name: "bgm-subject-characters-v1", maxAge: 3600, swr: true },
);

export const browseDiscovery = defineCachedFunction(
  async (filters: DiscoveryQuery): Promise<SearchResult> => {
    const offset = (filters.page - 1) * categoryPageSize;
    const query = { limit: categoryPageSize, offset };
    let result: { data: BgmSubject[]; total: number };
    if (filters.mode === "season") {
      const month = (Number(filters.quarter) - 1) * 3 + 1;
      const endMonth = month + 3;
      const end = endMonth > 12 ? `${Number(filters.year) + 1}-01-01` : `${filters.year}-${String(endMonth).padStart(2, "0")}-01`;
      result = await request("/v0/search/subjects", {
        method: "POST", query,
        body: { keyword: "", sort: filters.sort, filter: { type: [2], air_date: [`>=${filters.year}-${String(month).padStart(2, "0")}-01`, `<${end}`] } },
      });
    } else {
      result = await request("/v0/subjects", {
        query: { ...query, type: 2, sort: "rank", ...(filters.year !== "全部" ? { year: Number(filters.year) } : {}) },
      });
    }
    return { data: result.data.map(mapSubject), total: result.total, offset, limit: categoryPageSize };
  },
  { name: "bgm-discovery-v1", maxAge: 900, swr: true },
);
