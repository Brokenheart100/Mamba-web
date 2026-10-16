import { afterEach, describe, expect, it, vi } from "vitest";
import {
  allowedDanmakuRedirect,
  createDandanplayClient,
  dandanplaySignature,
  parseDandanplayComments,
} from "../server/providers/danmaku/dandanplay";
import { danmakuId, onlineDanmakuMaxAge } from "../shared/utils/online-danmaku";
import {
  danmakuServiceStatus,
  dandanplayClient,
} from "../server/utils/dandanplay";

const matchBody = {
  success: true,
  bangumi: {
    animeId: 100,
    animeTitle: "番剧第二季",
    seasons: [{ id: "s2", name: "第二季" }],
    episodes: [
      {
        episodeId: 100000001,
        episodeTitle: "第1话 相遇",
        episodeNumber: "1",
        seasonId: "s2",
      },
    ],
  },
};
const commentBody = {
  count: 1,
  comments: [{ cid: 1, p: "0,1,16777215,user-1", m: "你好" }],
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
const setup = (
  fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(commentBody)),
  now?: () => number,
) => ({
  fetcher,
  client: createDandanplayClient({
    appId: "unit-app",
    secret: "not-a-real-key",
    fetcher,
    now,
  }),
});
afterEach(() => vi.unstubAllGlobals());

describe("official dandanplay protocol", () => {
  it("signs the documented concatenation as base64 SHA256 without query parameters", async () => {
    expect(
      dandanplaySignature(
        "unit-app",
        "not-a-real-key",
        "1735660800",
        "/api/v2/comment/123450001",
      ),
    ).toBe("b1t4cd8G5sU+VA0aB3ABCyYt8fMZtbAxpp0lVYsHCBc=");
    const { client, fetcher } = setup(undefined, () => 1735660800000);
    await client.comments("123450001");
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://api.dandanplay.net/api/v2/comment/123450001?withRelated=true&chConvert=0",
    );
    const headers = new Headers(init?.headers);
    expect(headers.get("X-Signature")).toBe(
      "b1t4cd8G5sU+VA0aB3ABCyYt8fMZtbAxpp0lVYsHCBc=",
    );
    expect(headers.get("X-AppSecret")).toBeNull();
  });

  it("follows public CDN redirects without forwarding any application authentication", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location: "https://comment.dandanplay.net/pools/123.json",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "latest.json" },
        }),
      )
      .mockResolvedValueOnce(json(commentBody));
    const { client } = setup(fetcher);
    expect((await client.comments("123")).items[0]?.text).toBe("你好");
    expect(String(fetcher.mock.calls[2]![0])).toBe(
      "https://comment.dandanplay.net/pools/latest.json",
    );
    for (const [, init] of fetcher.mock.calls.slice(1)) {
      const headers = new Headers(init?.headers);
      expect(headers.get("X-AppId")).toBeNull();
      expect(headers.get("X-Signature")).toBeNull();
      expect(headers.get("X-Timestamp")).toBeNull();
    }
  });

  it("rejects redirects outside the fixed HTTPS provider boundary", async () => {
    for (const url of [
      "http://comment.dandanplay.net/x",
      "https://dandanplay.net.evil.example/x",
      "https://localhost/x",
      "https://api.dandanplay.net:8443/x",
      "https://user@api.dandanplay.net/x",
    ]) {
      expect(() => allowedDanmakuRedirect(url)).toThrow();
    }
    const { client, fetcher } = setup(
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: "https://127.0.0.1/admin" },
        }),
      ),
    );
    await expect(client.comments("123")).rejects.toThrow("未允许");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent requests and refreshes the shared pool after expiration", async () => {
    let time = Date.now();
    const { client, fetcher } = setup(
      vi.fn<typeof fetch>().mockImplementation(async () => json(commentBody)),
      () => time,
    );
    await Promise.all([client.comments("123"), client.comments("123")]);
    await client.comments("123");
    expect(fetcher).toHaveBeenCalledTimes(1);
    time += onlineDanmakuMaxAge + 1;
    await client.comments("123");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("preserves separate Bangumi and provider IDs, season labels, and manual search parameters", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(matchBody))
      .mockResolvedValueOnce(
        json({
          success: true,
          hasMore: true,
          animes: [
            {
              animeId: 200,
              animeTitle: "第二季",
              episodes: [
                { episodeId: "9223372036854775807", episodeTitle: "特别篇" },
              ],
            },
          ],
        }),
      );
    const { client } = setup(fetcher);
    expect((await client.match(400602)).matches[0]).toMatchObject({
      animeId: "100",
      episodeId: "100000001",
      episodeNumber: "1",
      seasonTitle: "第二季",
    });
    const result = await client.search("番剧 第二季", "S1");
    expect(result.matches[0]?.episodeId).toBe("9223372036854775807");
    expect(result.hasMore).toBe(true);
    const url = new URL(String(fetcher.mock.calls[1]![0]));
    expect(url.searchParams.get("anime")).toBe("番剧 第二季");
    expect(url.searchParams.get("episode")).toBe("S1");
    expect(url.searchParams.get("v2")).toBe("true");
  });

  it("handles absent mappings and nullable empty lists", async () => {
    const { client } = setup(
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(json({ success: true, animes: null })),
    );
    expect((await client.match(400602)).matches).toEqual([]);
    expect((await client.search("番剧", "")).matches).toEqual([]);
    expect(
      parseDandanplayComments({ comments: null, count: 0 }, "123").items,
    ).toEqual([]);
  });

  it("sanitizes authentication, business errors, and invalid JSON; failures do not poison caches", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("upstream secret details", { status: 403 }),
      )
      .mockResolvedValueOnce(
        json({ success: false, errorMessage: "not-a-real-key" }),
      )
      .mockResolvedValueOnce(new Response("invalid-json-secret"))
      .mockResolvedValueOnce(json(commentBody));
    const { client } = setup(fetcher);
    await expect(client.comments("123")).rejects.toMatchObject({
      statusCode: 503,
      message: "弹幕服务认证失败，请联系站点管理员。",
    });
    await expect(client.comments("123")).rejects.toThrow("处理失败");
    await expect(client.comments("123")).rejects.toThrow("暂时无法连接");
    expect((await client.comments("123")).items).toHaveLength(1);
  });

  it("rejects oversized declared responses and reports rate limits", async () => {
    const { client } = setup(
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response("{}", { headers: { "Content-Length": "9000000" } }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 429 })),
    );
    await expect(client.comments("123")).rejects.toThrow("过大");
    await expect(client.comments("123")).rejects.toMatchObject({
      statusCode: 429,
    });
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(8 * 1024 * 1024 + 1));
        controller.close();
      },
    });
    const streamingClient = setup(
      vi.fn<typeof fetch>().mockResolvedValue(new Response(stream)),
    ).client;
    await expect(streamingClient.comments("123")).rejects.toThrow("过大");
  });
});

describe("danmaku data and configuration", () => {
  it("normalizes colors, modes and seconds, drops malformed / duplicate rows and never interprets HTML", () => {
    const result = parseDandanplayComments(
      {
        comments: [
          { p: "2.5,1,255,user", m: "<b>纯文本</b>" },
          { p: "0,4,16711680,user", m: "底部" },
          { p: "1,5,broken,user", m: "顶部" },
          { p: "2.5,1,255,another-user", m: "<b>纯文本</b>" },
          { p: "-1,1,0,u", m: "坏时间" },
          { p: "3,6,0,u", m: "未知模式" },
          { p: " ,1,0,u", m: "坏时间" },
        ],
      },
      "123",
      1000,
    );
    expect(
      result.items.map(({ time, color, mode, text }) => ({
        time,
        color,
        mode,
        text,
      })),
    ).toEqual([
      { time: 0, color: "#ff0000", mode: "bottom", text: "底部" },
      { time: 1, color: "#ffffff", mode: "top", text: "顶部" },
      { time: 2.5, color: "#0000ff", mode: "scroll", text: "<b>纯文本</b>" },
    ]);
    expect(result.skipped).toBe(4);
    expect(JSON.stringify(result)).not.toContain("another-user");
  });
  it("retains the earliest 50000 valid entries and reports truncation", () => {
    const result = parseDandanplayComments(
      {
        comments: Array.from({ length: 50001 }, (_, i) => ({
          p: `${50000 - i},1,0,u`,
          m: String(i),
        })),
      },
      "123",
    );
    expect(result.items).toHaveLength(50000);
    expect(result.items[0]?.time).toBe(0);
    expect(result.truncated).toBe(true);
  });
  it("keeps 64-bit IDs as strings and rejects unsafe or malformed numeric IDs", () => {
    expect(danmakuId("9223372036854775807")).toBe("9223372036854775807");
    for (const id of [
      0,
      -1,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
      "1e3",
      "01",
      "9223372036854775808",
      "https://example.com",
    ])
      expect(() => danmakuId(id)).toThrow();
  });
  it("reports missing or disabled credentials without attempting a network request", () => {
    vi.stubGlobal("useRuntimeConfig", () => ({
      dandanplayEnabled: true,
      dandanplayAppId: "",
    }));
    vi.stubGlobal(
      "createError",
      (options: { message: string }) => new Error(options.message),
    );
    expect(danmakuServiceStatus().state).toBe("unconfigured");
    expect(() => dandanplayClient()).toThrow("尚未配置");
    vi.stubGlobal("useRuntimeConfig", () => ({
      dandanplayEnabled: false,
      dandanplayAppId: "x",
      dandanplayAppSecret: "y",
    }));
    expect(danmakuServiceStatus().state).toBe("disabled");
  });
});
