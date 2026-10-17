import { createHash } from "node:crypto";
import { createError } from "h3";
import { LRUCache } from "lru-cache";
import type { Danmaku } from "#shared/types/media";
import type {
  DanmakuSearchResult,
  OnlineDanmakuResult,
} from "#shared/types/online-danmaku";
import {
  danmakuId,
  onlineDanmakuMaxAge,
  validateDanmakuMatch,
} from "#shared/utils/online-danmaku";

const apiOrigin = "https://api.dandanplay.net";
const maxBodyBytes = 8 * 1024 * 1024;
type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
const unavailable = (
  message = "在线弹幕暂时无法连接，请稍后重试。",
  statusCode = 502,
) => createError({ statusCode, message });

export function dandanplaySignature(
  appId: string,
  secret: string,
  timestamp: string,
  path: string,
) {
  return createHash("sha256")
    .update(appId + timestamp + path + secret)
    .digest("base64");
}
export function allowedDanmakuRedirect(
  value: string,
  extraHosts: string[] = [],
): URL {
  const url = new URL(value);
  const host = url.hostname;
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !(
      ["dandanplay.net", "dandanplay.com"].some(
        (root) => host === root || host.endsWith(`.${root}`),
      ) || extraHosts.includes(host)
    )
  )
    throw unavailable("弹幕服务跳转到了未允许的域名，请联系站点管理员。");
  return url;
}

export function parseDandanplayComments(
  value: unknown,
  episodeId: string,
  now = Date.now(),
): OnlineDanmakuResult {
  const data = object(value);
  const comments = Array.isArray(data.comments)
    ? data.comments
    : data.comments === null && data.count === 0
      ? []
      : undefined;
  if (!comments) throw unavailable("弹幕服务返回了无法识别的数据。");
  const items: Danmaku[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const [index, input] of comments.entries()) {
    const row = object(input);
    const parts = typeof row.p === "string" ? row.p.split(",") : [];
    const time = parts[0]?.trim() ? Number(parts[0]) : NaN;
    const mode = parts[1];
    const color = parts[2]?.trim() ? Number(parts[2]) : NaN;
    if (
      !Number.isFinite(time) ||
      time < 0 ||
      time > 86400 ||
      !["1", "4", "5"].includes(mode || "") ||
      typeof row.m !== "string" ||
      !row.m.trim() ||
      row.m.length > 300
    ) {
      skipped++;
      continue;
    }
    const item: Danmaku = {
      id: `ddp:${episodeId}:${index}`,
      time,
      text: row.m,
      mode: mode === "4" ? "bottom" : mode === "5" ? "top" : "scroll",
      color:
        Number.isInteger(color) && color >= 0 && color <= 0xffffff
          ? `#${color.toString(16).padStart(6, "0")}`
          : "#ffffff",
    };
    const fingerprint = JSON.stringify([
      item.time,
      item.mode,
      item.color,
      item.text,
    ]);
    if (seen.has(fingerprint)) {
      skipped++;
      continue;
    }
    seen.add(fingerprint);
    items.push(item);
  }
  items.sort((a, b) => a.time - b.time);
  return {
    episodeId,
    items: items.slice(0, 50000),
    fetchedAt: now,
    skipped,
    truncated: items.length > 50000,
  };
}

function parseMatches(value: unknown, mapped: boolean): DanmakuSearchResult {
  const data = object(value);
  if (mapped && data.bangumi === null) return { matches: [], hasMore: false };
  if (data.success !== true)
    throw unavailable("弹幕检索未成功，请稍后重试或更换关键词。");
  const animes = mapped
    ? [object(data.bangumi)]
    : data.animes === null
      ? []
      : data.animes;
  if (!Array.isArray(animes))
    throw unavailable("弹幕检索返回了无法识别的数据。");
  const matches: DanmakuSearchResult["matches"] = [];
  const seen = new Set<string>();
  for (const input of animes) {
    const anime = object(input);
    if (!Array.isArray(anime.episodes)) continue;
    const seasons = Array.isArray(anime.seasons)
      ? anime.seasons.map(object)
      : [];
    for (const input of anime.episodes) {
      const episode = object(input);
      try {
        const season = seasons.find((s) => s.id === episode.seasonId);
        const match = validateDanmakuMatch({
          animeId: anime.animeId,
          animeTitle: anime.animeTitle,
          episodeId: episode.episodeId,
          episodeTitle: episode.episodeTitle,
          episodeNumber: episode.episodeNumber,
          seasonTitle: season?.name,
        });
        if (!seen.has(match.episodeId)) {
          matches.push(match);
          seen.add(match.episodeId);
        }
      } catch {
        /* Skip malformed entries rather than select the wrong episode. */
      }
    }
  }
  return {
    matches: matches.slice(0, 2000),
    hasMore: data.hasMore === true || matches.length > 2000,
  };
}

export function createDandanplayClient(options: {
  appId: string;
  secret: string;
  extraCdnHosts?: string[];
  fetcher?: typeof fetch;
  now?: () => number;
}) {
  const fetcher = options.fetcher || fetch;
  const now = options.now || Date.now;
  type CacheValue = DanmakuSearchResult | OnlineDanmakuResult;
  const cache = new LRUCache<string, CacheValue>({
    max: 100,
    maxSize: 16 * 1024 * 1024,
    sizeCalculation: (value) => Math.max(1, Buffer.byteLength(JSON.stringify(value))),
    ttlResolution: 0,
    ...(options.now ? { perf: { now } } : {}),
  });
  // Keep at most four distinct in-flight jobs separate from the cache:
  // cache eviction must not start a duplicate upstream request.
  const pending = new Map<string, Promise<unknown>>();

  async function request(
    path: string,
    query: Record<string, string> = {},
    allowMissing = false,
  ): Promise<unknown> {
    const url = new URL(path, apiOrigin);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    const timestamp = String(Math.floor(now() / 1000));
    const signal = AbortSignal.timeout(12000);
    try {
      let currentUrl = url;
      let response = await fetcher(url, {
        redirect: "manual",
        signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "Mamba-Animation/0.1 (danmaku reader)",
          "X-AppId": options.appId,
          "X-Timestamp": timestamp,
          "X-Signature": dandanplaySignature(
            options.appId,
            options.secret,
            timestamp,
            path,
          ),
        },
      });
      for (
        let hops = 0;
        [301, 302, 303, 307, 308].includes(response.status);
        hops++
      ) {
        const location = response.headers.get("location");
        if (!location || hops >= 3) throw unavailable("弹幕服务跳转异常。");
        const target = allowedDanmakuRedirect(
          new URL(location, currentUrl).href,
          options.extraCdnHosts,
        );
        await response.body?.cancel();
        currentUrl = target;
        // CDN requests never receive application credentials, signature or timestamp.
        response = await fetcher(target, {
          redirect: "manual",
          signal,
          headers: { Accept: "application/json" },
        });
      }
      if (response.status === 404 && allowMissing) {
        await response.body?.cancel();
        return { success: true, bangumi: null };
      }
      if (
        !response.ok ||
        Number(response.headers.get("content-length")) > maxBodyBytes
      )
        await response.body?.cancel();
      if ([401, 403].includes(response.status))
        throw unavailable("弹幕服务认证失败，请联系站点管理员。", 503);
      if (response.status === 429)
        throw unavailable("在线弹幕额度或请求频率受限，请稍后重试。", 429);
      if (!response.ok) throw unavailable();
      if (Number(response.headers.get("content-length")) > maxBodyBytes)
        throw unavailable("弹幕数据过大，请使用本地弹幕。");
      const reader = response.body?.getReader();
      if (!reader) throw unavailable();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const result = await reader.read();
          if (result.done) break;
          size += result.value.byteLength;
          if (size > maxBodyBytes) {
            await reader.cancel();
            throw unavailable("弹幕数据过大，请使用本地弹幕。");
          }
          chunks.push(result.value);
        }
      } finally {
        reader.releaseLock();
      }
      const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (
        object(data).success === false &&
        !(allowMissing && object(data).bangumi === null)
      )
        throw unavailable("弹幕服务处理失败，请稍后重试。");
      return data;
    } catch (error) {
      if (error instanceof Error && "statusCode" in error) throw error;
      throw unavailable(
        signal.aborted ? "在线弹幕请求超时，可以稍后重试。" : undefined,
        signal.aborted ? 504 : 502,
      );
    }
  }

  async function cached<T extends CacheValue>(
    key: string,
    ttl: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const hit = cache.get(key);
    if (hit) return hit as T;
    if (pending.has(key)) return pending.get(key) as Promise<T>;
    if (pending.size >= 4)
      throw unavailable("在线弹幕服务繁忙，请稍后重试。", 503);
    const task = load()
      .then((value) => {
        cache.set(key, value, { ttl });
        return value;
      })
      .finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  }
  return {
    search: (keyword: string, episode: string) =>
      cached(
        `search:${JSON.stringify([keyword, episode])}`,
        2 * 3600000,
        async () =>
          parseMatches(
            await request("/api/v2/search/episodes", {
              anime: keyword,
              ...(episode ? { episode } : {}),
              v2: "true",
            }),
            false,
          ),
      ),
    match: (subjectId: number) =>
      cached(`match:${subjectId}`, onlineDanmakuMaxAge, async () =>
        parseMatches(
          await request(`/api/v2/bangumi/bgmtv/${subjectId}`, {}, true),
          true,
        ),
      ),
    comments: (episodeId: string) =>
      cached(
        `comments:${danmakuId(episodeId)}`,
        onlineDanmakuMaxAge,
        async () =>
          parseDandanplayComments(
            await request(`/api/v2/comment/${danmakuId(episodeId)}`, {
              withRelated: "true",
              chConvert: "0",
            }),
            episodeId,
            now(),
          ),
      ),
  };
}
