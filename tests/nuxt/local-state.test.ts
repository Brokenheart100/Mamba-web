import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { defineComponent, nextTick } from "vue";
import { usePinia } from "#imports";
import { useSourcePreferences } from "../../app/composables/useSourcePreferences";
import { useLocalLibraryStore } from "../../app/stores/local-library";
import { useSourcePreferencesStore } from "../../app/stores/source-preferences";
import ContinueWatching from "../../app/components/ContinueWatching.vue";
import * as library from "../../app/repositories/local-library";
import type { VideoSourceInfo, WatchProgress } from "../../shared/types/media";

const sources: VideoSourceInfo[] = [
  {
    id: "first",
    name: "一",
    website: "https://example.com",
    tier: 1,
    defaultEnabled: true,
    initialStatus: "unverified",
    note: "",
  },
  {
    id: "second",
    name: "二",
    website: "https://example.org",
    tier: 2,
    defaultEnabled: false,
    initialStatus: "unverified",
    note: "",
  },
];
const row = (episodeId: number, subjectId = 1): WatchProgress => ({
  key: `${subjectId}:${episodeId}`,
  subjectId,
  episodeId,
  subjectName: `番剧${subjectId}`,
  episodeName: `章节${episodeId}`,
  image: "",
  sort: episodeId,
  position: 45,
  duration: 600,
  completed: false,
  updatedAt: episodeId,
  sourceId: "first",
  channel: "一",
});
const PreferenceView = defineComponent({
  setup: () => useSourcePreferences(),
  template: '<p>{{ enabledIds?.join(",") }}</p>',
});

beforeEach(async () => {
  localStorage.clear();
  await library.clearProgress();
  useLocalLibraryStore(usePinia()).$patch({
    records: [],
    ready: false,
    storageError: "",
  });
  useSourcePreferencesStore(usePinia()).$patch({
    enabledIds: null,
    statuses: {},
    preferenceError: "",
  });
});

describe("Pinia state in the Nuxt runtime", () => {
  it("renders existing IndexedDB records, groups subjects, and reacts to deletion", async () => {
    await library.saveProgress(row(1));
    await library.saveProgress(row(2));
    await library.saveProgress(row(3, 2));
    const wrapper = await mountSuspended(ContinueWatching);
    try {
      await vi.waitFor(() =>
        expect(wrapper.findAll(".continue-link")).toHaveLength(2),
      );
      expect(
        wrapper
          .findAll(".continue-link")
          .map((link) => link.attributes("href")),
      ).toEqual(["/watch/2/3", "/watch/1/2"]);
      const store = useLocalLibraryStore(usePinia());
      await store.toggleCompleted(store.records[0]!);
      expect(wrapper.text()).toContain("已看完");
      await store.remove("2:3");
      await nextTick();
      expect(wrapper.findAll(".continue-link")).toHaveLength(1);
      expect(await library.getProgress("1:2")).toBeDefined();
    } finally {
      wrapper.unmount();
    }
  });

  it("keeps a failed IndexedDB read visible without discarding existing session records", async () => {
    const store = useLocalLibraryStore(usePinia());
    store.records = [row(1)];
    vi.spyOn(library, "listProgress").mockRejectedValueOnce(
      new Error("storage blocked"),
    );
    await store.refresh();
    expect(store.ready).toBe(true);
    expect(store.storageError).toContain("无法读取");
    expect(store.records).toHaveLength(1);
  });

  it("does not let an earlier slow read overwrite a newer refresh", async () => {
    const store = useLocalLibraryStore(usePinia());
    let finishEarlier!: (rows: WatchProgress[]) => void;
    vi.spyOn(library, "listProgress")
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishEarlier = resolve;
          }),
      )
      .mockResolvedValueOnce([row(2)]);
    const earlier = store.refresh();
    await store.refresh();
    finishEarlier([row(1)]);
    await earlier;
    expect(store.records.map((record) => record.key)).toEqual(["1:2"]);
  });

  it("drops removed source IDs and keeps two mounted consumers synchronized", async () => {
    localStorage.setItem(
      "ani.source-preferences.v1",
      JSON.stringify(["second", "removed", "second"]),
    );
    const store = useSourcePreferencesStore(usePinia());
    store.initialize(sources);
    const first = await mountSuspended(PreferenceView);
    const second = await mountSuspended(PreferenceView);
    try {
      expect(first.text()).toBe("second");
      store.setEnabled("first", true);
      await nextTick();
      expect(first.text()).toBe("second,first");
      expect(second.text()).toBe(first.text());
      expect(
        JSON.parse(localStorage.getItem("ani.source-preferences.v1")!),
      ).toEqual(["second", "first"]);
    } finally {
      first.unmount();
      second.unmount();
    }
  });

  it("preserves an intentional empty source selection across initialization", () => {
    localStorage.setItem("ani.source-preferences.v1", "[]");
    const store = useSourcePreferencesStore(usePinia());
    store.initialize(sources);
    expect(store.enabledIds).toEqual([]);
    store.setDefaults(sources);
    expect(store.enabledIds).toEqual(["first"]);
  });

  it("recovers malformed preferences and keeps session changes when writes fail", () => {
    localStorage.setItem("ani.source-preferences.v1", "broken JSON");
    const store = useSourcePreferencesStore(usePinia());
    store.initialize(sources);
    expect(store.enabledIds).toEqual(["first"]);
    expect(store.preferenceError).toContain("无法读取");
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("quota");
      },
    });
    try {
      store.setEnabled("second", true);
      expect(store.enabledIds).toEqual(["first", "second"]);
      expect(store.preferenceError).toContain("无法保存");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
