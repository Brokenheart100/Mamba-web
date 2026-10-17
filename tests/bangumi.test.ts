import { createError } from "h3";
import { createFetch } from "ofetch";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { categoryQuerySchema } from "../shared/schemas/categories";
import { currentSeason, discoveryQuerySchema } from "../shared/schemas/discovery";

let provider: typeof import("../server/providers/metadata/bangumi");
const fetcher = vi.fn<typeof fetch>();
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json" },
});

beforeAll(async () => {
  // Test the request transport and domain mapping independently of Nitro's cache.
  vi.stubGlobal("defineCachedFunction", (fn: unknown) => fn);
  provider = await import("../server/providers/metadata/bangumi");
  vi.unstubAllGlobals();
});
beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal("$fetch", createFetch({ fetch: fetcher }));
  vi.stubGlobal("createError", createError);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Bangumi ofetch transport", () => {
  it.each([
    ["1", ">=2024-01-01", "<2024-04-01"],
    ["2", ">=2024-04-01", "<2024-07-01"],
    ["3", ">=2024-07-01", "<2024-10-01"],
    ["4", ">=2024-10-01", "<2025-01-01"],
  ])("covers every month in quarter %s with exclusive upper bounds", async (quarter, start, end) => {
    fetcher.mockResolvedValue(json({ data: [], total: 0 }));
    await provider.browseDiscovery(discoveryQuerySchema.parse({ year: "2024", quarter, page: "2", sort: "score" }));
    const [input, options] = fetcher.mock.calls[0]!;
    expect(JSON.parse(options?.body as string)).toEqual({ keyword: "", sort: "score", filter: { type: [2], air_date: [start, end] } });
    expect(new URL(String(input)).searchParams.get("offset")).toBe("20");
  });

  it("uses the official ranking and year query while preserving upstream ranks", async () => {
    fetcher.mockImplementation(async () => json({ data: [{ id: 326, name: "测试榜首", rating: { rank: 1 } }], total: 9060 }));
    const result = await provider.browseDiscovery(discoveryQuerySchema.parse({ mode: "ranking", page: "2" }));
    const url = new URL(String(fetcher.mock.calls[0]![0]));
    expect(url.pathname).toBe("/v0/subjects");
    expect(Object.fromEntries(url.searchParams)).toEqual({ limit: "20", offset: "20", type: "2", sort: "rank" });
    expect(result.data[0]?.rank).toBe(1);
    await provider.browseDiscovery(discoveryQuerySchema.parse({ mode: "ranking", year: "2024" }));
    expect(new URL(String(fetcher.mock.calls[1]![0])).searchParams.get("year")).toBe("2024");
  });

  it("defaults to the Shanghai season at a UTC quarter boundary and rejects malformed URLs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-31T16:01:00Z"));
    expect(currentSeason()).toEqual({ year: "2026", quarter: "1" });
    expect(discoveryQuerySchema.parse({})).toMatchObject({ year: "2026", quarter: "1", page: 1 });
    expect(discoveryQuerySchema.parse({ mode: "ranking", sort: "heat" })).toMatchObject({ year: "全部", sort: "rank" });
    for (const input of [{ quarter: "5" }, { year: "2024 OR 1=1" }, { year: ["2024", "2025"] }, { page: "51" }, { page: "0" }]) {
      expect(discoveryQuerySchema.safeParse(input).success).toBe(false);
    }
  });

  it("maps related media types and nullable images without extra detail requests", async () => {
    fetcher.mockResolvedValue(json([
      { id: 10, name: "原作", name_cn: null, type: 1, relation: "原作", images: null },
      { id: 11, name: "续集", type: 2, relation: "续集", images: { common: "http://example.com/a.jpg" } },
    ]));
    const result = await provider.getRelatedSubjects(400602);
    expect(result[0]).toMatchObject({ type: 1, relation: "原作", subject: { id: 10, platform: "书籍", image: "" } });
    expect(result[1]?.subject.image).toBe("https://example.com/a.jpg");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps character voice actors, tolerates missing data, and strips unused upstream fields", async () => {
    fetcher.mockResolvedValue(json([
      { id: 12, name: "角色", relation: "主角", images: null, actors: [{ id: 13, name: "声优", images: { large: "http://example.com/b.jpg" }, secret: "unused" }] },
      { id: 14, name: "暂无声优", actors: null },
    ]));
    const result = await provider.getSubjectCharacters(400602);
    expect(result[0]).toEqual({ id: 12, name: "角色", relation: "主角", image: "", actors: [{ id: 13, name: "声优", image: "https://example.com/b.jpg" }] });
    expect(result[1]).toMatchObject({ relation: "角色", image: "", actors: [] });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed relation and character payloads with sanitized errors", async () => {
    fetcher.mockImplementation(async () => json({ secret: "upstream-private-details" }));
    await expect(provider.getRelatedSubjects(1)).rejects.toThrow("关联作品资料暂时无法读取");
    await expect(provider.getSubjectCharacters(1)).rejects.toThrow("角色与声优资料暂时无法读取");
  });
  it("browses the complete upstream index with combined tags, year bounds and pagination", async () => {
    fetcher.mockResolvedValue(json({ data: [{ id: 1, name_cn: "分类测试", date: "2024-03-01" }], total: 73 }));
    const result = await provider.browseAnime(categoryQuerySchema.parse({
      region: "国产动画", format: "TV", genre: "奇幻", year: "2024", sort: "score", page: "2",
    }));
    const [input, options] = fetcher.mock.calls[0]!;
    const url = new URL(String(input));
    expect(url.searchParams.get("offset")).toBe("20");
    expect(url.searchParams.get("limit")).toBe("20");
    expect(JSON.parse(options?.body as string)).toEqual({
      keyword: "", sort: "score",
      filter: { type: [2], tag: ["中国", "TV", "奇幻"], air_date: [">=2024-01-01", "<2025-01-01"] },
    });
    expect(result).toMatchObject({ total: 73, offset: 20, limit: 20 });
    expect(result.data[0]?.name).toBe("分类测试");
  });

  it("omits all-category filters and supports older animation without filtering a fetched page", async () => {
    fetcher.mockImplementation(async () => json({ data: [], total: 0 }));
    await provider.browseAnime(categoryQuerySchema.parse({}));
    expect(JSON.parse(fetcher.mock.calls[0]![1]?.body as string)).toEqual({ keyword: "", sort: "heat", filter: { type: [2] } });
    await provider.browseAnime(categoryQuerySchema.parse({ year: "2000以前", format: "剧场版", page: "50" }));
    expect(JSON.parse(fetcher.mock.calls[1]![1]?.body as string).filter).toEqual({ type: [2], tag: ["剧场版"], air_date: ["<2000-01-01"] });
    expect(new URL(String(fetcher.mock.calls[1]![0])).searchParams.get("offset")).toBe("980");
  });

  it("rejects unsupported filter values, duplicate parameters and inaccessible pages", () => {
    for (const input of [{ sort: "latest" }, { region: "unknown" }, { genre: ["科幻", "奇幻"] }, { page: "51" }, { page: "-1" }, { year: "2024 OR 1=1" }]) {
      expect(categoryQuerySchema.safeParse(input).success).toBe(false);
    }
  });
  it("serializes the POST search body, query and headers through ofetch", async () => {
    fetcher.mockResolvedValue(json({ data: [{ id: 1, name_cn: "番剧", images: { large: "http://example.com/cover.jpg" } }], total: 1 }));
    const result = await provider.searchSubjects("动画 & 第二季", 24);
    const [input, options] = fetcher.mock.calls[0]!;
    const url = new URL(String(input));
    expect(url.origin + url.pathname).toBe("https://api.bgm.tv/v0/search/subjects");
    expect(url.searchParams.get("offset")).toBe("24");
    expect(url.searchParams.get("limit")).toBe("20");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(options?.body as string)).toEqual({ keyword: "动画 & 第二季", sort: "match", filter: { type: [2] } });
    expect(new Headers(options?.headers).get("User-Agent")).toContain("Mamba-Animation");
    expect(result.data[0]).toMatchObject({ id: 1, name: "番剧", image: "https://example.com/cover.jpg" });
  });

  it("preserves pagination and episode sorting", async () => {
    fetcher.mockResolvedValueOnce(json({ data: [{ id: 2, name: "第二集", sort: 2, type: 0 }], total: 2 }))
      .mockResolvedValueOnce(json({ data: [{ id: 1, name: "第一集", sort: 1, type: 0 }], total: 2 }));
    expect((await provider.getEpisodes(400602)).map((episode) => episode.id)).toEqual([1, 2]);
    expect(new URL(String(fetcher.mock.calls[1]![0])).searchParams.get("offset")).toBe("1");
  });

  it("keeps 404 separate from upstream errors without automatic retries or detail leaks", async () => {
    for (const status of [404, 429, 500]) {
      fetcher.mockResolvedValueOnce(json({ secret: "upstream-private-details" }, status));
      await expect(provider.getSubject(1)).rejects.toMatchObject({ statusCode: status === 404 ? 404 : 502 });
    }
    expect(fetcher).toHaveBeenCalledTimes(3);
    fetcher.mockRejectedValueOnce(new Error("upstream-private-details"));
    await expect(provider.getSubject(1)).rejects.toThrow("番剧资料暂时无法连接");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("aborts a slow request after twelve seconds without retrying", async () => {
    vi.useFakeTimers();
    fetcher.mockImplementation((_input, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
    }));
    const failure = expect(provider.getSubject(1)).rejects.toMatchObject({ statusCode: 502 });
    await vi.advanceTimersByTimeAsync(12_001);
    await failure;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
