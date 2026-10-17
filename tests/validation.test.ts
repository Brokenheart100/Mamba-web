import { createApp, eventHandler, getValidatedQuery, readValidatedBody, toWebHandler } from "h3";
import { describe, expect, it } from "vitest";
import { danmakuSearchQuerySchema, playbackBodySchema, subjectSearchQuerySchema } from "../shared/schemas/requests";
import { danmakuId } from "../shared/utils/online-danmaku";
import { validateDanmaku } from "../shared/utils/danmaku";
import { parseBackup } from "../shared/utils/media";

describe("validated data boundaries", () => {
  it("uses H3 validation to trim searches and return numeric pagination", async () => {
    const app = createApp().use(eventHandler((event) => getValidatedQuery(event, subjectSearchQuerySchema.parse)));
    const response = await toWebHandler(app)(new Request("http://localhost/?q=%20anime%20&offset=10"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ q: "anime", offset: 10 });
  });

  it("rejects duplicate and malformed query parameters instead of coercing arrays", async () => {
    const app = createApp().use(eventHandler((event) => getValidatedQuery(event, danmakuSearchQuerySchema.parse)));
    const request = toWebHandler(app);
    for (const query of ["q=anime&q=another", "q=anime&episode=1&episode=2", "q=anime&episode=1e2", "q=a"]) {
      expect((await request(new Request(`http://localhost/?${query}`))).status).toBe(400);
    }
    const response = await request(new Request("http://localhost/?q=anime&episode=S1"));
    expect(await response.json()).toEqual({ q: "anime", episode: "S1" });
  });

  it("rejects malformed playback bodies before resource token verification", async () => {
    const app = createApp().use(eventHandler((event) => readValidatedBody(event, playbackBodySchema.parse)));
    const request = toWebHandler(app);
    for (const body of [null, { resourceId: 123 }, { resourceId: "" }, { resourceId: "a".repeat(4097) }]) {
      expect((await request(new Request("http://localhost/", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }))).status).toBe(400);
    }
  });

  it("preserves the old backup app marker and rejects unsafe record IDs", () => {
    expect(parseBackup(JSON.stringify({ app: "animeko-web", version: 1, progress: [] }))).toEqual([]);
    for (const id of [NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, [], {}, "https://example.com", "9223372036854775808"]) {
      expect(() => danmakuId(id)).toThrow("编号无效");
    }
    expect(danmakuId("9223372036854775807")).toBe("9223372036854775807");
  });

  it("rejects non-finite times and UTF-16 oversized text while retaining import defaults", () => {
    for (const time of [NaN, Infinity, -Infinity]) {
      expect(() => validateDanmaku([{ time, text: "弹幕" }])).toThrow();
    }
    expect(() => validateDanmaku([{ time: 0, text: "😀".repeat(151) }])).toThrow();
    expect(validateDanmaku([{ time: 0, text: "<b>文字</b>", mode: "unknown", color: null }])[0]).toMatchObject({
      text: "<b>文字</b>", mode: "scroll", color: "#ffffff",
    });
  });
});
