import { createError } from "h3";
import { createFetch } from "ofetch";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { subjectCommentsQuerySchema, subjectCommentsResponseSchema } from "../shared/schemas/comments";

let provider: typeof import("../server/providers/metadata/bangumi-comments");
const fetcher = vi.fn<typeof fetch>();
const comment = {
  id: 1, comment: "<script>alert(1)</script>\n短评原文", rate: 8, type: 2, updatedAt: 1_792_158_737,
  user: { id: 123, username: "user/name", nickname: "观众", avatar: { small: "http://lain.bgm.tv/avatar.jpg" }, sign: "unused profile" },
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
beforeAll(async () => {
  vi.stubGlobal("defineCachedFunction", (fn: unknown) => fn);
  provider = await import("../server/providers/metadata/bangumi-comments");
  vi.unstubAllGlobals();
});
beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal("$fetch", createFetch({ fetch: fetcher }));
  vi.stubGlobal("createError", createError);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("Bangumi anonymous short comments", () => {
  it("reads the documented complete episode thread array, then pages root comments locally", async () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      id: index + 1, mainID: 1227087, relatedID: 0, content: `讨论 ${index + 1}`, createdAt: 1_792_158_737, state: 0,
      user: comment.user, replies: [],
    }));
    fetcher.mockResolvedValue(json(rows));
    const result = await provider.getEpisodeComments(1227087, 2);
    const [input, options] = fetcher.mock.calls[0]!;
    const url = new URL(String(input));
    expect(url.origin + url.pathname).toBe("https://next.bgm.tv/p1/episodes/1227087/comments");
    expect(url.search).toBe("");
    expect(new Headers(options?.headers).has("Authorization")).toBe(false);
    expect(new Headers(options?.headers).has("Cookie")).toBe(false);
    expect(result).toMatchObject({ total: 25, offset: 20, limit: 20 });
    expect(result.data.map((row) => row.id)).toEqual([21, 22, 23, 24, 25]);
  });

  it("keeps replies and creation dates while withholding unavailable comment content", async () => {
    const row = { id: 1, mainID: 1227087, relatedID: 0, content: "主评论", createdAt: 12345, state: 0, user: comment.user };
    fetcher.mockResolvedValue(json([{ ...row, replies: [{ ...row, id: 2, relatedID: 1, state: 6, content: "hidden-comment", user: null }] }]));
    const result = await provider.getEpisodeComments(1227087, 1);
    expect(result.data[0]).toMatchObject({ content: "主评论", createdAt: 12345, episodeId: 1227087 });
    expect(result.data[0]?.replies[0]).toMatchObject({ relatedId: 1, content: "这条评论暂不可见。", user: { name: "Bangumi 用户", url: "" } });
    expect(JSON.stringify(result)).not.toContain("hidden-comment");
  });

  it.each(["root", "reply"])("rejects a different episode ID in a %s comment", async (target) => {
    const row = { id: 1, mainID: 1227087, relatedID: 0, content: "讨论", createdAt: 12345, state: 0 };
    fetcher.mockResolvedValue(json([{ ...row, ...(target === "root" ? { mainID: 999 } : {}), replies: target === "reply" ? [{ ...row, id: 2, mainID: 999 }] : [] }]));
    await expect(provider.getEpisodeComments(1227087, 1)).rejects.toMatchObject({ statusCode: 502 });
  });

  it("rejects malformed episode data instead of showing another response as empty comments", async () => {
    fetcher.mockResolvedValue(json({ data: [], secret: "private-upstream" }));
    await expect(provider.getEpisodeComments(1227087, 1)).rejects.toThrow("本集讨论资料暂时无法读取");
  });

  it.each([1, 2, 5, 6, 7])("withholds episode comment content for upstream unavailable state %s", async (state) => {
    fetcher.mockResolvedValue(json([{ id: 1, mainID: 1227087, relatedID: 0, content: "hidden-content", createdAt: 12345, state, replies: [] }]));
    expect((await provider.getEpisodeComments(1227087, 1)).data[0]?.content).toBe("这条评论暂不可见。");
  });

  it.each([3, 4, 8])("keeps content visible for upstream readable state %s", async (state) => {
    fetcher.mockResolvedValue(json([{ id: 1, mainID: 1227087, relatedID: 0, content: "可读评论", createdAt: 12345, state, replies: [] }]));
    expect((await provider.getEpisodeComments(1227087, 1)).data[0]?.content).toBe("可读评论");
  });
  it("uses the documented p1 host and pagination without cookies or auth headers", async () => {
    fetcher.mockResolvedValue(json({ data: [comment], total: 41 }));
    const result = await provider.getSubjectComments(400602, 2);
    const [input, options] = fetcher.mock.calls[0]!;
    const url = new URL(String(input));
    expect(url.origin + url.pathname).toBe("https://next.bgm.tv/p1/subjects/400602/comments");
    expect(Object.fromEntries(url.searchParams)).toEqual({ limit: "20", offset: "20" });
    const headers = new Headers(options?.headers);
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.has("Cookie")).toBe(false);
    expect(result).toMatchObject({ total: 41, offset: 20, limit: 20 });
    expect(result.data[0]).toEqual({ id: 1, content: comment.comment, rating: 8, status: "看过", updatedAt: comment.updatedAt, user: { name: "观众", avatar: "https://lain.bgm.tv/avatar.jpg", url: "https://bgm.tv/user/user%2Fname" } });
  });

  it("supports zero ratings and absent avatars without leaking unused profile fields", () => {
    const parsed = subjectCommentsResponseSchema.parse({ data: [{ ...comment, rate: 0, user: { id: 123, username: "", nickname: null, avatar: null } }], total: 1 });
    expect(parsed.data[0]).toMatchObject({ rating: 0, user: { name: "Bangumi 用户", avatar: "", url: "https://bgm.tv/user/123" } });
  });

  it.each(["javascript:alert(1)", "https://evil.example/avatar.jpg", "https://lain.bgm.tv@evil.example/a", "https://user:pass@lain.bgm.tv/a"])("discards unsafe avatar URLs: %s", (small) => {
    const parsed = subjectCommentsResponseSchema.parse({ data: [{ ...comment, user: { ...comment.user, avatar: { small } } }], total: 1 });
    expect(parsed.data[0]?.user.avatar).toBe("");
  });

  it("rejects duplicate, invalid and excessive pagination inputs", () => {
    expect(subjectCommentsQuerySchema.parse({})).toEqual({ page: 1 });
    expect(subjectCommentsQuerySchema.parse({ page: "10000" })).toEqual({ page: 10000 });
    for (const page of ["0", "-1", "1.5", "10001", ["1", "2"], "1 OR 1=1"]) {
      expect(subjectCommentsQuerySchema.safeParse({ page }).success).toBe(false);
    }
  });

  it("sanitizes malformed upstream data", async () => {
    fetcher.mockResolvedValue(json({ data: [{ ...comment, rate: 999, secret: "private-upstream" }], total: 1 }));
    await expect(provider.getSubjectComments(1, 1)).rejects.toMatchObject({ statusCode: 502, message: "评论资料暂时无法读取，可前往 Bangumi 查看。" });
  });

  it("handles future auth restrictions, rate limits and failures without leaking details or retrying", async () => {
    for (const [status, expected] of [[401, 503], [403, 503], [429, 503], [404, 404], [500, 502]]) {
      fetcher.mockResolvedValueOnce(json({ secret: "private-upstream" }, status));
      await expect(provider.getSubjectComments(1, 1)).rejects.toMatchObject({ statusCode: expected });
    }
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("aborts slow comment requests after twelve seconds", async () => {
    vi.useFakeTimers();
    fetcher.mockImplementation((_input, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
    }));
    const failure = expect(provider.getSubjectComments(1, 1)).rejects.toMatchObject({ statusCode: 502 });
    await vi.advanceTimersByTimeAsync(12_001);
    await failure;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
