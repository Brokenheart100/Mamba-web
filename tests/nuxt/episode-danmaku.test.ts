import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { defineComponent, h, ref } from "vue";
import { openDB } from "idb";
import { createError } from "h3";
import { useEpisodeDanmaku } from "../../app/composables/useEpisodeDanmaku";
import { readDanmaku, storeDanmaku } from "../../app/repositories/danmaku";
import {
  readDanmakuSelection,
  saveDanmakuSelection,
  saveOnlineDanmakuCache,
  readOnlineDanmakuCache,
} from "../../app/repositories/online-danmaku";
import { onlineDanmakuMaxAge } from "../../shared/utils/online-danmaku";
import type { Subject, Episode } from "../../shared/types/media";
import type { DanmakuMatch, DanmakuSearchResult, OnlineDanmakuResult } from "../../shared/types/online-danmaku";
import DanmakuPanel from "../../app/components/player/DanmakuPanel.vue";
import { defaultSettings } from "../../shared/utils/media";

const key = "400602:1227087";
const subject: Subject = {
  id: 400602,
  name: "葬送的芙莉莲",
  originalName: "葬送のフリーレン",
  image: "",
  summary: "",
  date: "2023-09-29",
  score: 9,
  ratingCount: 10,
  rank: 1,
  platform: "TV",
  episodes: 28,
  tags: [],
};
const episode: Episode = {
  id: 1227087,
  subjectId: 400602,
  sort: 1,
  type: 0,
  name: "冒险结束",
  airdate: "",
  duration: "",
};
const candidate = {
  animeId: "100",
  episodeId: "1000001",
  animeTitle: "葬送的芙莉莲",
  episodeTitle: "第1话 冒险结束",
  episodeNumber: "1",
};
const local = [
  {
    id: "0",
    time: 1,
    text: "我的本地弹幕",
    color: "#ffffff",
    mode: "scroll" as const,
  },
];
const pool = (): OnlineDanmakuResult => ({
  episodeId: candidate.episodeId,
  items: [{ ...local[0]!, text: "在线测试弹幕" }],
  fetchedAt: Date.now(),
  skipped: 0,
  truncated: false,
});
let available = true;
let commentCalls = 0;
let searchCalls = 0;
let failComments = false;
let held: Promise<OnlineDanmakuResult> | undefined;
let mapping: DanmakuSearchResult;
let heldMapping: Promise<DanmakuSearchResult> | undefined;
let failMapping = false;
registerEndpoint("/api/danmaku/status", () => ({
  available,
  state: available ? "ready" : "unconfigured",
  message: available ? "弹弹play" : "站点尚未配置在线弹幕，仍可导入本地文件。",
}));
registerEndpoint("/api/danmaku/match", () => {
  searchCalls++;
  if (failMapping) throw createError({ statusCode: 503, message: "测试：映射暂时不可用" });
  return heldMapping || mapping;
});
registerEndpoint("/api/danmaku/search", () => {
  searchCalls++;
  return { matches: [candidate], hasMore: false };
});
registerEndpoint(`/api/danmaku/${candidate.episodeId}`, () => {
  commentCalls++;
  if (failComments)
    throw createError({ statusCode: 503, message: "测试：弹幕服务暂时不可用" });
  return held || pool();
});
async function mountControl(current = episode, delayed = false) {
  let control!: ReturnType<typeof useEpisodeDanmaku>;
  const anime = ref<Subject | null>(delayed ? null : subject);
  const chapter = ref<Episode | undefined>(delayed ? undefined : current);
  const Harness = defineComponent({
    setup() {
      control = useEpisodeDanmaku(key, anime, chapter);
      return () => h("p", control.message.value);
    },
  });
  const wrapper = await mountSuspended(Harness);
  await vi.waitFor(() => expect(control.ready.value).toBe(true));
  return { control, wrapper, anime, chapter };
}
beforeEach(async () => {
  available = true;
  commentCalls = 0;
  searchCalls = 0;
  failComments = false;
  held = undefined;
  mapping = { matches: [candidate], hasMore: false };
  heldMapping = undefined;
  failMapping = false;
  await readDanmakuSelection(key);
  await readDanmaku(key);
  const onlineDb = await openDB("ani-online-danmaku", 1);
  await onlineDb.clear("selections");
  await onlineDb.clear("cache");
  onlineDb.close();
  const localDb = await openDB("ani-local-danmaku", 1);
  await localDb.clear("episodes");
  localDb.close();
});

describe("episode danmaku flow in Nuxt", () => {
  it("automatically loads and persists the uniquely mapped regular episode on first open", async () => {
    const { control, wrapper } = await mountControl();
    try {
      await vi.waitFor(() => expect(control.message.value).toContain("已自动匹配本集"));
      expect(control.mode.value).toBe("online");
      expect(control.items.value[0]?.text).toBe("在线测试弹幕");
      expect(searchCalls).toBe(1);
      expect(commentCalls).toBe(1);
      expect((await readDanmakuSelection(key))?.match).toEqual(candidate);
    } finally { wrapper.unmount(); }
  });

  it("waits for metadata before automatically matching the current episode", async () => {
    const { control, wrapper, anime, chapter } = await mountControl(episode, true);
    try {
      expect(searchCalls).toBe(0);
      anime.value = subject;
      chapter.value = episode;
      await vi.waitFor(() => expect(control.mode.value).toBe("online"));
      expect(commentCalls).toBe(1);
    } finally { wrapper.unmount(); }
  });

  it.each<[string, DanmakuMatch[]]>([
    ["ambiguous pools", [candidate, { ...candidate, episodeId: "1000002" }]],
    ["another season", [{ ...candidate, animeTitle: "葬送的芙莉莲 第二季" }]],
    ["missing episode number", [{ ...candidate, episodeNumber: undefined }]],
    ["unclear season metadata", [{ ...candidate, seasonTitle: "第二季" }]],
  ])("requires manual selection for %s", async (_label, matches) => {
    mapping.matches = matches;
    const { control, wrapper } = await mountControl();
    try {
      await vi.waitFor(() => expect(control.message.value).toContain("手动选择"));
      expect(commentCalls).toBe(0);
      expect(control.mode.value).toBe("local");
      expect(await readDanmakuSelection(key)).toBeUndefined();
    } finally { wrapper.unmount(); }
  });

  it("requires manual selection when the mapped result is incomplete", async () => {
    mapping.hasMore = true;
    const { control, wrapper } = await mountControl();
    try {
      await vi.waitFor(() => expect(control.message.value).toContain("手动选择"));
      expect(commentCalls).toBe(0);
    } finally { wrapper.unmount(); }
  });

  it("does not guess special episode numbering", async () => {
    const { control, wrapper } = await mountControl({ ...episode, type: 1 });
    try {
      await vi.waitFor(() => expect(control.message.value).toContain("特别篇"));
      expect(searchCalls).toBe(0);
      expect(commentCalls).toBe(0);
    } finally { wrapper.unmount(); }
  });

  it("preserves an explicitly selected local mode even without an imported file", async () => {
    await saveDanmakuSelection(key, { mode: "local" });
    const { control, wrapper } = await mountControl();
    try {
      expect(control.mode.value).toBe("local");
      expect(searchCalls).toBe(0);
      expect(commentCalls).toBe(0);
    } finally { wrapper.unmount(); }
  });

  it("leaves automatic mapping failures retryable without saving a false match", async () => {
    failMapping = true;
    const { control, wrapper } = await mountControl();
    try {
      await vi.waitFor(() => expect(control.message.value).toContain("重试"));
      expect(commentCalls).toBe(0);
      expect(await readDanmakuSelection(key)).toBeUndefined();
    } finally { wrapper.unmount(); }
  });

  it("does not let a delayed automatic match override an explicit switch to local", async () => {
    let release!: (result: DanmakuSearchResult) => void;
    heldMapping = new Promise((resolve) => { release = resolve; });
    const { control, wrapper } = await mountControl();
    try {
      await vi.waitFor(() => expect(searchCalls).toBe(1));
      await control.useLocal();
      release(mapping);
      await vi.waitFor(() => expect(control.searching.value).toBe(false));
      expect(commentCalls).toBe(0);
      expect(control.mode.value).toBe("local");
      expect((await readDanmakuSelection(key))?.mode).toBe("local");
    } finally { release(mapping); wrapper.unmount(); }
  });
  it("keeps imported files active and never fetches comments before a user confirms a pool", async () => {
    await storeDanmaku(key, local);
    const { control, wrapper } = await mountControl();
    try {
      expect(control.items.value[0]?.text).toBe("我的本地弹幕");
      await control.search();
      expect(control.matches.value[0]?.episodeId).toBe(candidate.episodeId);
      expect(control.mode.value).toBe("local");
      expect(commentCalls).toBe(0);
      await control.loadOnline(candidate);
      expect(control.items.value[0]?.text).toBe("在线测试弹幕");
      expect((await readDanmakuSelection(key))?.match).toEqual(candidate);
      expect(await readOnlineDanmakuCache(candidate.episodeId)).toBeDefined();
      await control.useLocal();
      expect(control.items.value[0]?.text).toBe("我的本地弹幕");
    } finally {
      wrapper.unmount();
    }
  });

  it("restores a confirmed fresh cache even when credentials are unavailable", async () => {
    available = false;
    await saveDanmakuSelection(key, { mode: "online", match: candidate });
    await saveOnlineDanmakuCache(pool());
    const { control, wrapper } = await mountControl();
    try {
      await vi.waitFor(() =>
        expect(control.items.value[0]?.text).toBe("在线测试弹幕"),
      );
      expect(control.mode.value).toBe("online");
      expect(commentCalls).toBe(0);
      expect(searchCalls).toBe(0);
    } finally {
      wrapper.unmount();
    }
  });

  it("preserves expired cached comments if the service fails while refreshing", async () => {
    failComments = true;
    await saveDanmakuSelection(key, { mode: "online", match: candidate });
    await saveOnlineDanmakuCache({
      ...pool(),
      fetchedAt: Date.now() - onlineDanmakuMaxAge - 1,
    });
    const { control, wrapper } = await mountControl();
    try {
      await vi.waitFor(() => expect(control.busy.value).toBe(false));
      expect(commentCalls).toBe(1);
      expect(control.items.value[0]?.text).toBe("在线测试弹幕");
      expect(control.message.value).toContain("已保留本地缓存");
    } finally {
      wrapper.unmount();
    }
  });

  it("does not let a slow online response override a switch back to local files", async () => {
    let release!: (value: OnlineDanmakuResult) => void;
    held = new Promise((resolve) => {
      release = resolve;
    });
    await storeDanmaku(key, local);
    const { control, wrapper } = await mountControl();
    try {
      const loading = control.loadOnline(candidate);
      await vi.waitFor(() => expect(commentCalls).toBe(1));
      await control.useLocal();
      release(pool());
      await loading;
      expect(control.mode.value).toBe("local");
      expect(control.items.value[0]?.text).toBe("我的本地弹幕");
      expect((await readDanmakuSelection(key))?.mode).toBe("local");
    } finally {
      release(pool());
      wrapper.unmount();
    }
  });

  it("shows the unconfigured state while keeping local import controls usable", async () => {
    available = false;
    await storeDanmaku(key, local);
    const wrapper = await mountSuspended(DanmakuPanel, {
      props: { storageKey: key, subject, episode, settings: defaultSettings },
    });
    try {
      await vi.waitFor(() => expect(wrapper.text()).toContain("尚未配置"));
      expect(
        wrapper
          .findAll("button")
          .find((button) => button.text().includes("查找在线弹幕"))
          ?.attributes("disabled"),
      ).toBeDefined();
      expect(
        wrapper.get("input[type=file]").attributes("disabled"),
      ).toBeUndefined();
      expect(wrapper.emitted("items")?.at(-1)?.[0]).toEqual(local);
    } finally {
      wrapper.unmount();
    }
  });
});
