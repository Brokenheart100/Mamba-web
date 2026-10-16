import { acceptHMRUpdate, defineStore } from "pinia";
import { ref } from "vue";
import type { SourceCheck, VideoSourceInfo } from "#shared/types/media";

const storageKey = "ani.source-preferences.v1";
export const useSourcePreferencesStore = defineStore(
  "source-preferences",
  () => {
    const enabledIds = ref<string[] | null>(null);
    const statuses = ref<Record<string, SourceCheck>>({});
    const preferenceError = ref("");
    function initialize(sources: VideoSourceInfo[]) {
      if (import.meta.server || !sources.length || enabledIds.value !== null)
        return;
      const defaults = () =>
        sources.filter((s) => s.defaultEnabled).map((s) => s.id);
      try {
        const raw = localStorage.getItem(storageKey);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        enabledIds.value =
          Array.isArray(parsed) && parsed.every((id) => typeof id === "string")
            ? [
              ...new Set(
                parsed.filter((id) =>
                  sources.some((source) => source.id === id),
                ),
              ),
            ]
            : defaults();
      } catch {
        enabledIds.value = defaults();
        preferenceError.value = "源偏好暂时无法读取，正在使用默认配置。";
      }
    }
    function persist(message: string) {
      if (import.meta.server) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(enabledIds.value));
        preferenceError.value = "";
      } catch {
        preferenceError.value = message;
      }
    }
    function setEnabled(id: string, value: boolean) {
      if (enabledIds.value === null) return;
      enabledIds.value = value
        ? [...new Set([...enabledIds.value, id])]
        : enabledIds.value.filter((key) => key !== id);
      persist("本次源偏好已生效，但无法保存到此浏览器。");
    }
    function setDefaults(sources: VideoSourceInfo[]) {
      enabledIds.value = sources
        .filter((s) => s.defaultEnabled)
        .map((s) => s.id);
      persist("无法保存默认源偏好。");
    }
    return {
      enabledIds,
      statuses,
      preferenceError,
      initialize,
      setEnabled,
      setDefaults,
    };
  },
);
if (import.meta.hot)
  import.meta.hot.accept(
    acceptHMRUpdate(useSourcePreferencesStore, import.meta.hot),
  );
