import { load } from "cheerio";
import { safeMediaUrl } from "#shared/utils/media";
import { sourcePath, type SourceDefinition } from "./catalog";

export interface SourceSubject {
  name: string;
  path: string;
}
export interface SourceChapter {
  name: string;
  path: string;
  channel: string;
  sort: number;
  type: number;
}

// Some sites return their HTML as a JSON string through content negotiation.
export function decodeSourceBody(text: string): string {
  if (!text.trimStart().startsWith('"')) return text;
  try {
    const decoded: unknown = JSON.parse(text);
    return typeof decoded === "string" ? decoded : text;
  } catch {
    return text;
  }
}

export function parseSourceSubjects(
  source: SourceDefinition,
  text: string,
): SourceSubject[] {
  const rows: SourceSubject[] = [];
  if (source.search.kind === "json") {
    const data: unknown = JSON.parse(text);
    const list =
      data &&
      typeof data === "object" &&
      "list" in data &&
      Array.isArray(data.list)
        ? data.list
        : [];
    for (const item of list.slice(0, 30)) {
      if (
        !item ||
        typeof item.name !== "string" ||
        !Number.isSafeInteger(Number(item.id)) ||
        Number(item.id) <= 0
      )
        continue;
      const path = sourcePath(
        source,
        source.search.jsonLinkTemplate.replace("{value}", String(item.id)),
      );
      if (path) rows.push({ name: load(item.name).text().trim(), path });
    }
  } else {
    const $ = load(text);
    if (source.search.kind === "indexed") {
      const links = $(source.search.links);
      $(source.search.names).each((index, el) => {
        const path = sourcePath(source, links.eq(index).attr("href") || "");
        const name = $(el).text().trim();
        if (path && name) rows.push({ path, name });
      });
    } else {
      $(source.search.anchors).each((_, el) => {
        const path = sourcePath(source, $(el).attr("href") || "");
        const name = $(el).text().trim() || $(el).attr("title") || "";
        if (path && name) rows.push({ path, name });
      });
    }
  }
  return [...new Map(rows.map((row) => [row.path, row])).values()].slice(0, 30);
}

export function parseSourceChapters(
  source: SourceDefinition,
  text: string,
): SourceChapter[] {
  const $ = load(text);
  const names = $(source.chapters.names)
    .map(
      (_, el) =>
        $(el).clone().children().remove().end().text().trim() ||
        $(el).text().trim(),
    )
    .get();
  const rows: SourceChapter[] = [];
  const groups = source.chapters.groups ? $(source.chapters.groups) : $("body");
  groups.each((index, group) => {
    const nodes = $(group).find(source.chapters.episodes);
    const links = source.chapters.links
      ? $(group).find(source.chapters.links)
      : nodes;
    nodes.each((i, el) => {
      const path = sourcePath(
        source,
        links.eq(i).attr("href") || $(el).closest("a").attr("href") || "",
      );
      const name = $(el).text().trim();
      // Reject quality labels such as 1080P; require an actual numeric episode label.
      const number = name.match(
        /^(?:(?:第\s*)?(\d{1,4}(?:\.\d+)?)\s*(?:集|话|話|回)?|(?:SP|OVA|OAD|特别篇|特別篇)\s*(\d+(?:\.\d+)?))(?:\s|$|[-：:])/i,
      );
      if (path && number)
        rows.push({
          path,
          name,
          channel: names[index] || `线路 ${index + 1}`,
          sort: Number(number[1] || number[2]),
          type: /SP|特别|特別|OVA|OAD/i.test(name) ? 1 : 0,
        });
    });
  });
  return [
    ...new Map(rows.map((row) => [`${row.path}:${row.channel}`, row])).values(),
  ].slice(0, 5000);
}

export function parsePlayback(text: string): {
  url: string;
  transport: "mp4" | "hls";
} {
  const $ = load(text);
  const candidates: string[] = [];
  for (const script of $("script").toArray()) {
    const content = $(script).html() || "";
    const match = content.match(
      /(?:var\s+)?player_[\w]+\s*=\s*(\{[\s\S]*\})\s*;?\s*$/,
    );
    if (!match?.[1]) continue;
    try {
      const data: unknown = JSON.parse(match[1]);
      if (
        !data ||
        typeof data !== "object" ||
        !("url" in data) ||
        typeof data.url !== "string"
      )
        continue;
      const mode = "encrypt" in data ? Number(data.encrypt) : 0;
      candidates.push(
        mode === 0
          ? data.url
          : mode === 1
            ? decodeURIComponent(data.url)
            : mode === 2
              ? decodeURIComponent(
                  Buffer.from(data.url, "base64").toString("utf8"),
                )
              : "",
      );
    } catch {
      /* Reject executable or malformed player configuration. */
    }
  }
  $("video[src], video source[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src) candidates.push(src);
  });
  $("iframe[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src) candidates.push(src);
  });
  for (let raw of candidates) {
    for (let depth = 0; depth < 3; depth++) {
      let url: URL;
      try {
        url = new URL(safeMediaUrl(raw));
      } catch {
        break;
      }
      const transport = /\.m3u8$/i.test(url.pathname)
        ? "hls"
        : /\.mp4$/i.test(url.pathname)
          ? "mp4"
          : null;
      if (transport) return { url: url.href, transport };
      const nested = ["url", "src", "v", "play"]
        .map((key) => url.searchParams.get(key))
        .find(Boolean);
      if (!nested) break;
      raw = nested;
    }
  }
  throw new Error(
    "这条线路需要额外网页解析或不支持的格式，请换线或打开源站观看。",
  );
}
