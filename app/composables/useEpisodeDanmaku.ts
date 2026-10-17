import type { Ref } from "vue";
import type { Danmaku, Episode, Subject } from "#shared/types/media";
import type {
  DanmakuMatch,
  DanmakuSearchResult,
  DanmakuServiceStatus,
  OnlineDanmakuResult,
} from "#shared/types/online-danmaku";
import { onlineDanmakuMaxAge } from "#shared/utils/online-danmaku";
import { normalizeTitle } from "#shared/utils/media";
import { danmakuSearchResultSchema } from "#shared/schemas/danmaku";
import {
  importDanmaku,
  readDanmaku,
  storeDanmaku,
} from "../repositories/danmaku";
import {
  readDanmakuSelection,
  saveDanmakuSelection,
  readOnlineDanmakuCache,
  saveOnlineDanmakuCache,
  validateOnlineDanmaku,
} from "../repositories/online-danmaku";

export function useEpisodeDanmaku(
  key: string,
  subject: Ref<Subject | null | undefined>,
  episode: Ref<Episode | undefined>,
) {
  const items = shallowRef<Danmaku[]>([]);
  const localItems = shallowRef<Danmaku[]>([]);
  const mode = ref<"local" | "online">("local");
  const match = shallowRef<DanmakuMatch>();
  const ready = ref(false);
  const busy = ref(false);
  const message = ref("正在读取弹幕…");
  const service = shallowRef<DanmakuServiceStatus>();
  const serviceMessage = ref("");
  const matches = shallowRef<DanmakuMatch[]>([]);
  const searching = ref(false);
  const searchMessage = ref("");
  const autoEligible = ref(false);
  let autoAttempted = false;
  let alive = true;
  let generation = 0;
  let searchGeneration = 0;
  let controller: AbortController | undefined;
  let searchController: AbortController | undefined;

  const errorText = (error: unknown) => {
    const data = error as { data?: { message?: string }; message?: string };
    return (
      data.data?.message || "在线弹幕暂时无法连接，可以重试或使用本地文件。"
    );
  };
  function cancelLoad() {
    ++generation;
    controller?.abort();
    busy.value = false;
  }
  function cancelSearch() {
    ++searchGeneration;
    searchController?.abort();
    searching.value = false;
  }
  async function persistSelection() {
    try {
      await saveDanmakuSelection(key, {
        mode: mode.value,
        match: match.value ? { ...match.value } : undefined,
      });
    } catch {
      if (alive) message.value += " 本次选择未能保存到本地。";
    }
  }
  async function useLocal() {
    autoEligible.value = false;
    cancelSearch();
    cancelLoad();
    mode.value = "local";
    items.value = localItems.value;
    message.value = localItems.value.length
      ? `已加载本地弹幕，共 ${localItems.value.length} 条。`
      : "可导入 XML / JSON 弹幕，文件仅保存在本地。";
    await persistSelection();
  }
  async function upload(file: File) {
    autoEligible.value = false;
    cancelSearch();
    cancelLoad();
    const request = generation;
    try {
      const value = await importDanmaku(file);
      if (!alive || request !== generation) return;
      localItems.value = value;
      items.value = value;
      mode.value = "local";
      message.value = `已导入 ${value.length} 条弹幕，仅保存在本地。`;
      try {
        await storeDanmaku(key, value);
      } catch {
        if (alive) message.value += " 文件未能保存到本地。";
      }
      if (alive && request === generation) await persistSelection();
    } catch (error) {
      if (alive && request === generation)
        message.value =
          error instanceof Error ? error.message : "弹幕文件无法读取。";
    }
  }
  async function loadOnline(candidate: DanmakuMatch, reload = false) {
    autoEligible.value = false;
    cancelSearch();
    cancelLoad();
    const request = generation;
    busy.value = true;
    let cached: OnlineDanmakuResult | undefined;
    try {
      cached = await readOnlineDanmakuCache(candidate.episodeId);
    } catch {
      /* Network still works without storage. */
    }
    if (!alive || request !== generation) return;
    // A different candidate is committed only after a successful response or cache read.
    if (cached) {
      mode.value = "online";
      match.value = candidate;
      items.value = cached.items;
      message.value = `弹弹play · 缓存 ${cached.items.length} 条弹幕。`;
      await persistSelection();
      if (!alive || request !== generation) return;
    }
    const fresh =
      cached &&
      cached.fetchedAt <= Date.now() &&
      Date.now() - cached.fetchedAt < onlineDanmakuMaxAge;
    if ((fresh && !reload) || !service.value?.available) {
      if (!cached)
        message.value =
          serviceMessage.value ||
          service.value?.message ||
          "在线弹幕尚未就绪，当前弹幕保留。";
      else if (!fresh)
        message.value += " 缓存已过期，在线服务恢复后可重新加载。";
      busy.value = false;
      return;
    }
    controller = new AbortController();
    try {
      const result = validateOnlineDanmaku(
        await $fetch<OnlineDanmakuResult>(
          `/api/danmaku/${candidate.episodeId}`,
          { signal: controller.signal, timeout: 15000, retry: 0 },
        ),
      );
      if (result.episodeId !== candidate.episodeId)
        throw new Error("弹幕库编号不一致。");
      if (!alive || request !== generation) return;
      mode.value = "online";
      match.value = candidate;
      items.value = result.items;
      message.value = `弹弹play · 已加载 ${result.items.length} 条弹幕。${result.truncated ? " 仅显示时间最早的 50000 条。" : ""}`;
      try {
        await saveOnlineDanmakuCache(result);
      } catch {
        if (alive && request === generation)
          message.value += " 弹幕缓存未能保存。";
      }
      if (alive && request === generation) await persistSelection();
    } catch (error) {
      if (!alive || request !== generation) return;
      message.value = `${errorText(error)}${cached ? " 已保留本地缓存弹幕。" : " 当前弹幕未更换。"}`;
    } finally {
      if (alive && request === generation) busy.value = false;
    }
  }
  async function search(keyword?: string, episodeFilter = "") {
    autoEligible.value = false;
    cancelSearch();
    const request = searchGeneration;
    matches.value = [];
    searchMessage.value = "";
    searching.value = true;
    searchController = new AbortController();
    try {
      const result = danmakuSearchResultSchema.parse(await $fetch<DanmakuSearchResult>(
        keyword === undefined ? "/api/danmaku/match" : "/api/danmaku/search",
        {
          query:
            keyword === undefined
              ? { subjectId: subject.value?.id }
              : { q: keyword, episode: episodeFilter },
          signal: searchController.signal,
          timeout: 15000,
          retry: 0,
        },
      ));
      if (!alive || request !== searchGeneration) return;
      const current = episode.value;
      // Sort likely regular episodes first, but never silently select a result.
      matches.value = [...result.matches].sort(
        (a, b) =>
          Number(b.episodeNumber === String(current?.sort)) -
          Number(a.episodeNumber === String(current?.sort)),
      );
      searchMessage.value = result.matches.length
        ? `找到 ${result.matches.length} 个剧集，请核对番剧、季度和集数。${result.hasMore ? " 结果较多，请缩小搜索范围。" : ""}`
        : "没有找到对应弹幕库，可以修改番剧名或清空集数后搜索。";
      return result;
    } catch (error) {
      if (alive && request === searchGeneration)
        searchMessage.value = errorText(error);
    } finally {
      if (alive && request === searchGeneration) searching.value = false;
    }
  }
  async function autoMatch() {
    const current = episode.value;
    const anime = subject.value;
    if (!current || !anime || current.subjectId !== anime.id || current.type !== 0 || !Number.isInteger(current.sort) || current.sort <= 0) {
      message.value = "特别篇或集数不明确，请点击“查找在线弹幕”手动选择。";
      return;
    }
    const request = generation;
    message.value = "正在自动匹配本集弹幕…";
    const result = await search();
    if (!alive || request !== generation) return;
    if (!result) {
      message.value = `${searchMessage.value} 可点击“查找在线弹幕”重试。`;
      return;
    }
    const names = new Set([anime.name, anime.originalName].map(normalizeTitle).filter(Boolean));
    const exact = result.matches.filter((row) =>
      names.has(normalizeTitle(row.animeTitle)) &&
      !row.seasonTitle?.trim() &&
      /^\d+$/.test(row.episodeNumber?.trim() || "") &&
      Number(row.episodeNumber) === current.sort,
    );
    if (result.hasMore || exact.length !== 1) {
      message.value = "未找到唯一明确的本集弹幕库，请点击“查找在线弹幕”手动选择。";
      return;
    }
    await loadOnline(exact[0]!);
    if (alive && mode.value === "online" && match.value?.episodeId === exact[0]!.episodeId) {
      message.value += " 已自动匹配本集，可通过“查找在线弹幕”更换。";
    }
  }
  watch([autoEligible, subject, episode], () => {
    if (!autoEligible.value || autoAttempted || !subject.value || !episode.value) return;
    autoAttempted = true;
    void autoMatch();
  }, { flush: "post" });
  onMounted(async () => {
    const [local, selection, status] = await Promise.allSettled([
      readDanmaku(key),
      readDanmakuSelection(key),
      $fetch<DanmakuServiceStatus>("/api/danmaku/status", {
        timeout: 5000,
        retry: 0,
      }),
    ]);
    if (!alive) return;
    if (status.status === "fulfilled") {
      service.value = status.value;
      serviceMessage.value = status.value.message;
    } else
      serviceMessage.value = "在线弹幕状态暂时无法读取，仍可使用本地弹幕。";
    localItems.value = local.status === "fulfilled" ? local.value : [];
    items.value = localItems.value;
    message.value =
      local.status === "rejected"
        ? "本地弹幕未能读取，视频仍可正常播放。"
        : localItems.value.length
          ? `已加载本地弹幕，共 ${localItems.value.length} 条。`
          : "可导入 XML / JSON 弹幕，文件仅保存在本地。";
    if (selection.status === "fulfilled") match.value = selection.value?.match;
    ready.value = true;
    if (
      selection.status === "fulfilled" &&
      selection.value?.mode === "online" &&
      selection.value.match
    )
      await loadOnline(selection.value.match);
    else if (selection.status === "fulfilled" && !selection.value && local.status === "fulfilled" && !local.value.length && service.value?.available) {
      autoEligible.value = true;
    }
  });
  onBeforeUnmount(() => {
    alive = false;
    cancelLoad();
    cancelSearch();
  });
  return {
    items,
    localItems,
    mode,
    match,
    ready,
    busy,
    message,
    service,
    serviceMessage,
    matches,
    searching,
    searchMessage,
    search,
    cancelSearch,
    useLocal,
    upload,
    loadOnline,
  };
}
