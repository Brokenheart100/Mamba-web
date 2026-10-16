import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, ref } from "vue";
import type { WatchProgress } from "#shared/types/media";
import * as library from "../repositories/local-library";

export const useLocalLibraryStore = defineStore("local-library", () => {
  const records = ref<WatchProgress[]>([]);
  const ready = ref(false);
  const storageError = ref("");
  let readGeneration = 0;
  async function refresh() {
    if (import.meta.server) return;
    const generation = ++readGeneration;
    try {
      const rows = await library.listProgress();
      if (generation !== readGeneration) return;
      records.value = rows;
      storageError.value = "";
    } catch {
      if (generation !== readGeneration) return;
      storageError.value =
        "本地记录无法读取。你仍然可以播放视频，但进度可能无法保存。";
    } finally {
      if (generation === readGeneration) ready.value = true;
    }
  }
  async function remove(key: string) {
    try {
      await library.deleteProgress(key);
      await refresh();
    } catch {
      storageError.value = "删除失败，请检查浏览器存储权限。";
    }
  }
  async function toggleCompleted(row: WatchProgress) {
    try {
      await library.setCompleted(row.key, !row.completed);
      await refresh();
    } catch {
      storageError.value = "已看状态保存失败。";
    }
  }
  const recentSubjects = computed(() => {
    const ids = new Set<number>();
    return records.value.filter((row) => {
      if (ids.has(row.subjectId)) return false;
      ids.add(row.subjectId);
      return true;
    });
  });
  return {
    records,
    ready,
    storageError,
    refresh,
    remove,
    toggleCompleted,
    recentSubjects,
  };
});
if (import.meta.hot)
  import.meta.hot.accept(
    acceptHMRUpdate(useLocalLibraryStore, import.meta.hot),
  );
