import type {
  CalendarDay,
  Episode,
  SearchResult,
  Subject,
} from "#shared/types/media";

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
    const url = new URL(`https://api.bgm.tv${path}`);
    for (const [key, value] of Object.entries(options.query || {}))
      url.searchParams.set(key, String(value));
    const response = await fetch(url, {
      method: options.method || "GET",
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(12_000),
      headers: {
        "User-Agent": "AnimekoWeb/0.1 (Nuxt; local-first anime catalog)",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) throw { status: response.status };
    return (await response.json()) as T;
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
        query: { limit: 24, offset },
      },
    );
    return {
      data: result.data.map(mapSubject),
      total: result.total,
      offset,
      limit: 24,
    };
  },
  { name: "bgm-search", maxAge: 300, swr: true },
);
