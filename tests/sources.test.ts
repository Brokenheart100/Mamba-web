import { describe, expect, it } from "vitest";
import {
  sourceById,
  sourceDefinitions,
  sourcePath,
  validClaimPath,
  type SourceDefinition,
} from "../server/providers/video/catalog";
import {
  decodeSourceBody,
  parsePlayback,
  parseSourceChapters,
  parseSourceSubjects,
} from "../server/providers/video/parsers";

const fixture: SourceDefinition = {
  ...sourceById("xifan")!,
  origin: "https://example.com",
  allowedOrigins: ["https://example.com"],
  search: {
    kind: "a",
    anchors: ".result a",
    names: ".name",
    links: ".link",
    jsonLinkTemplate: "/detail/{value}.html",
  },
  chapters: {
    names: ".channel",
    groups: ".episodes",
    episodes: "a",
    links: "",
  },
};
describe("source catalogue and URL boundary", () => {
  it("registers 17 unique sources with vetted origins", () => {
    expect(sourceDefinitions).toHaveLength(17);
    expect(new Set(sourceDefinitions.map((s) => s.id)).size).toBe(17);
    for (const source of sourceDefinitions)
      expect(source.allowedOrigins).toContain(new URL(source.origin).origin);
  });
  it("accepts local paths but rejects external origins and credentials", () => {
    expect(sourcePath(fixture, "/play/1?line=2")).toBe("/play/1?line=2");
    for (const url of [
      "//127.0.0.1/admin",
      "https://evil.example/play",
      "https://a:b@example.com/",
      "javascript:alert(1)",
      "/play\\evil",
      "/play\n",
    ])
      expect(sourcePath(fixture, url)).toBeUndefined();
    for (const path of [
      "/../admin",
      "//example.com/play",
      "https://example.com/play",
      "/play#fragment",
    ])
      expect(validClaimPath(fixture, path)).toBe(false);
  });
});
describe("static source parsers", () => {
  it("unwraps HTML returned as JSON without evaluating scripts", () => {
    const html = '<a href="/detail/1">葬送的芙莉莲</a>';
    expect(decodeSourceBody(JSON.stringify(html))).toBe(html);
    expect(decodeSourceBody(html)).toBe(html);
    expect(decodeSourceBody('{"list":[]}')).toBe('{"list":[]}');
    expect(decodeSourceBody('"invalid')).toBe('"invalid');
  });
  it("extracts anchored results and drops unsafe or duplicate links", () => {
    expect(
      parseSourceSubjects(
        fixture,
        '<div class="result"><a href="/detail/1">葬送的芙莉莲</a><a href="/detail/1">葬送的芙莉莲</a><a href="https://evil.example/2">Bad</a></div>',
      ),
    ).toEqual([{ name: "葬送的芙莉莲", path: "/detail/1" }]);
  });
  it("supports indexed and JSON search formats", () => {
    expect(
      parseSourceSubjects(
        { ...fixture, search: { ...fixture.search, kind: "indexed" } },
        '<b class="name">Frieren</b><a class="link" href="/detail/2"></a>',
      ),
    ).toEqual([{ name: "Frieren", path: "/detail/2" }]);
    expect(
      parseSourceSubjects(
        { ...fixture, search: { ...fixture.search, kind: "json" } },
        JSON.stringify({
          list: [
            { id: 2, name: "Frieren" },
            { id: -1, name: "invalid" },
            { id: "../../admin", name: "invalid" },
          ],
        }),
      ),
    ).toEqual([{ name: "Frieren", path: "/detail/2.html" }]);
  });
  it("matches episode type and decimals without treating quality labels as episodes", () => {
    const rows = parseSourceChapters(
      fixture,
      '<h3 class="channel">HLS</h3><div class="episodes"><a href="/1">第01集</a><a href="/2">12.5话</a><a href="/3">SP 01</a><a href="/4">1080P</a><a href="https://evil.example/5">02</a></div>',
    );
    expect(rows.map((row) => [row.sort, row.type, row.channel])).toEqual([
      [1, 0, "HLS"],
      [12.5, 0, "HLS"],
      [1, 1, "HLS"],
    ]);
  });
  it("decodes documented player JSON and nested iframe URLs", () => {
    const url = "https://media.example/episode.m3u8?key=123";
    for (const [encrypt, value] of [
      [0, url],
      [1, encodeURIComponent(url)],
      [2, Buffer.from(encodeURIComponent(url)).toString("base64")],
    ]) {
      expect(
        parsePlayback(
          `<script>var player_aaaa=${JSON.stringify({ encrypt, url: value })}</script>`,
        ),
      ).toEqual({ url, transport: "hls" });
    }
    expect(
      parsePlayback(
        `<iframe src="https://player.example/?url=${encodeURIComponent(url)}"></iframe>`,
      ).url,
    ).toBe(url);
    expect(
      parsePlayback(
        '<video><source src="https://media.example/test.mp4"></video>',
      ).transport,
    ).toBe("mp4");
  });
  it("rejects executable configs, non-HTTPS media and unknown encryption", () => {
    for (const html of [
      "<script>player_a={url:runCode()}</script>",
      '<script>player_a={"url":"https://media.example/test.mp4","encrypt":3}</script>',
      '<video src="http://media.example/test.mp4"></video>',
      '<iframe src="https://player.example/?id=2"></iframe>',
    ])
      expect(() => parsePlayback(html)).toThrow("额外网页解析");
  });
});
