import type {
  Episode,
  PlaybackDescriptor,
  ResourceCandidate,
  SourceCheck,
  SourceState,
  Subject,
} from "#shared/types/media";
import { normalizeTitle } from "#shared/utils/media";
import { sourceById, type SourceDefinition } from "./catalog";
import {
  decodeSourceBody,
  parsePlayback,
  parseSourceChapters,
  parseSourceSubjects,
} from "./parsers";
import { signResource, type ResourceClaim } from "../../utils/resource-token";

export class SourceFailure extends Error {
  constructor(
    public state: SourceState,
    message: string,
  ) {
    super(message);
  }
}

async function sourcePage(
  source: SourceDefinition,
  path: string,
): Promise<string> {
  let url = new URL(path, source.origin);
  const signal = AbortSignal.timeout(10000);
  try {
    for (let hop = 0; hop < 4; hop++) {
      if (!source.allowedOrigins.includes(url.origin))
        throw new SourceFailure(
          "unsupported",
          "源站跳转到了未登记的域名，暂时无法自动读取。",
        );
      const response = await fetch(url, {
        signal,
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
          Accept: "text/html",
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location)
          throw new SourceFailure("unavailable", "源站返回了无效跳转。");
        url = new URL(location, url);
        continue;
      }
      if (response.status === 403 || response.status === 401) {
        await response.body?.cancel();
        throw new SourceFailure(
          "challenge",
          "源站要求验证或授权，当前无法自动读取。",
        );
      }
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new SourceFailure(
          "unavailable",
          `源站暂时无法连接（${response.status}）。`,
        );
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 2_000_000) {
          await reader.cancel();
          throw new SourceFailure("unsupported", "源站响应过大。");
        }
        chunks.push(part.value);
      }
      const data = Buffer.concat(chunks);
      const encoding =
        response.headers.get("content-type")?.match(/charset=([\w-]+)/i)?.[1] ||
        "utf-8";
      const text = decodeSourceBody(new TextDecoder(encoding).decode(data));
      if (
        /Just a moment|Checking your browser|Attention Required|cf-chl-/i.test(
          text,
        )
      )
        throw new SourceFailure(
          "challenge",
          "源站要求浏览器验证，请打开来源页面。",
        );
      return text;
    }
    throw new SourceFailure("unavailable", "源站跳转过多。");
  } catch (error) {
    if (error instanceof SourceFailure) throw error;
    throw new SourceFailure(
      "unavailable",
      "源站访问超时或网络连接失败，请稍后重试。",
    );
  }
}

const searchSource = defineCachedFunction(
  async (id: string, query: string) => {
    const source = sourceById(id)!;
    const text = await sourcePage(
      source,
      source.searchPath.replace("{query}", encodeURIComponent(query)),
    );
    return parseSourceSubjects(source, text);
  },
  { name: "source-search-v4", maxAge: 300, swr: false },
);

const sourceChapters = defineCachedFunction(
  async (id: string, path: string) => {
    const source = sourceById(id)!;
    return parseSourceChapters(source, await sourcePage(source, path));
  },
  { name: "source-chapters-v4", maxAge: 300, swr: false },
);

export async function checkSource(id: string): Promise<SourceCheck> {
  try {
    const rows = await searchSource(id, "葬送");
    return {
      id,
      state: rows.length ? "searchable" : "empty",
      count: rows.length,
      checkedAt: Date.now(),
      message: rows.length
        ? `检索到 ${rows.length} 个条目，播放需按线路验证。`
        : "搜索页面可访问，但未匹配到条目，可能是动态页面或站点结构变化。",
    };
  } catch (error) {
    return {
      id,
      state: error instanceof SourceFailure ? error.state : "unsupported",
      count: 0,
      checkedAt: Date.now(),
      message: error instanceof Error ? error.message : "此源暂时不可用。",
    };
  }
}

export async function findSourceResources(
  source: SourceDefinition,
  subject: Subject,
  episode: Episode,
): Promise<{ resources: ResourceCandidate[]; source: SourceCheck }> {
  const names = [
    ...new Set([subject.name, subject.originalName].filter(Boolean)),
  ];
  const resources: ResourceCandidate[] = [];
  const visited = new Set<string>();
  for (const name of names.slice(0, 2)) {
    const subjects = await searchSource(source.id, name);
    const exact = subjects.filter((candidate) =>
      names.some((n) => normalizeTitle(n) === normalizeTitle(candidate.name)),
    );
    const candidates = exact.length
      ? exact
      : subjects.filter((candidate) =>
          names.some((n) =>
            normalizeTitle(candidate.name).includes(normalizeTitle(n)),
          ),
        );
    for (const candidate of candidates.slice(0, 2)) {
      if (visited.has(candidate.path)) continue;
      visited.add(candidate.path);
      const matching = names.some(
        (n) => normalizeTitle(n) === normalizeTitle(candidate.name),
      );
      const chapters = await sourceChapters(source.id, candidate.path);
      for (const chapter of chapters.filter(
        (row) => row.sort === episode.sort && row.type === episode.type,
      )) {
        resources.push({
          id: signResource({
            sourceId: source.id,
            subjectId: subject.id,
            episodeId: episode.id,
            path: chapter.path,
            channel: chapter.channel,
          }),
          sourceId: source.id,
          sourceName: source.name,
          subjectName: candidate.name,
          episodeName: chapter.name,
          channel: chapter.channel,
          match: matching ? "exact" : "confirm",
        });
      }
    }
    if (resources.some((row) => row.match === "exact")) break;
  }
  return {
    resources,
    source: {
      id: source.id,
      state: resources.length ? "searchable" : "empty",
      count: resources.length,
      message: resources.length
        ? `找到 ${resources.length} 条候选线路。`
        : "没有找到此章节的匹配线路。",
      checkedAt: Date.now(),
    },
  };
}

export async function resolveSource(
  claim: ResourceClaim,
): Promise<PlaybackDescriptor> {
  const source = sourceById(claim.sourceId || "xifan")!;
  try {
    const html = await sourcePage(source, claim.path);
    return {
      ...parsePlayback(html),
      sourceName: source.name,
      channel: claim.channel,
    };
  } catch (error) {
    throw createError({
      statusCode: error instanceof SourceFailure ? 502 : 422,
      message:
        error instanceof Error ? error.message : "此线路暂不支持自动解析。",
    });
  }
}
