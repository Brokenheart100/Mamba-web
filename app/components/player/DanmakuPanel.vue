<script setup lang="ts">
import type {
  Danmaku,
  Episode,
  PlayerSettings,
  Subject,
} from "#shared/types/media";
import type { DanmakuMatch } from "#shared/types/online-danmaku";
import { normalizeSettings } from "#shared/utils/media";

const props = defineProps<{
  storageKey: string;
  subject?: Subject | null;
  episode?: Episode;
  settings: PlayerSettings;
}>();
const emit = defineEmits<{
  items: [items: Danmaku[]];
  settings: [settings: PlayerSettings];
}>();
const {
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
} = useEpisodeDanmaku(
  props.storageKey,
  toRef(props, "subject"),
  toRef(props, "episode"),
);
watch(items, (value) => emit("items", value), { immediate: true });
const pickerOpen = ref(false);
const keyword = ref("");
const episodeFilter = ref("");
watch(pickerOpen, (open) => {
  if (!open) cancelSearch();
});
function openPicker() {
  keyword.value = props.subject?.name || props.subject?.originalName || "";
  episodeFilter.value =
    props.episode?.type === 0 &&
    Number.isInteger(props.episode.sort) &&
    props.episode.sort > 0
      ? String(props.episode.sort)
      : "";
  pickerOpen.value = true;
  void search();
}
async function choose(candidate: DanmakuMatch) {
  await loadOnline(candidate, true);
  if (mode.value === "online" && match.value?.episodeId === candidate.episodeId)
    pickerOpen.value = false;
}
async function uploadFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) await upload(file);
  input.value = "";
}
function changeSettings(value: Partial<PlayerSettings>) {
  emit("settings", normalizeSettings({ ...props.settings, ...value }));
}
function offsetChanged(event: Event) {
  changeSettings({
    danmakuOffset: Number((event.target as HTMLInputElement).value),
  });
}
</script>

<template>
  <section class="panel danmaku-panel">
    <div class="panel-heading">
      <h2><UIcon aria-hidden="true" name="i-lucide-message-square" :size="18" />弹幕</h2>
      <div class="switch-label">
        <USwitch
          :model-value="settings.danmaku"
          color="success"
          aria-label="显示弹幕"
          @update:model-value="changeSettings({ danmaku: !!$event })"
        />显示弹幕
      </div>
    </div>
    <p class="muted" role="status" aria-live="polite">{{ message }}</p>
    <div class="online-danmaku-actions">
      <UButton
        icon="i-lucide-search"
        :disabled="!ready || !service?.available"
        @click="openPicker"
        >查找在线弹幕</UButton
      >
      <UButton
        v-if="match"
        color="neutral"
        variant="soft"
        :loading="busy"
        :disabled="!ready"
        @click="loadOnline(match, true)"
        >{{ mode === "online" ? "重新加载" : "使用在线弹幕" }}</UButton
      >
      <UButton
        color="neutral"
        :variant="mode === 'local' ? 'soft' : 'ghost'"
        :disabled="!ready"
        @click="useLocal"
        >本地弹幕<span v-if="localItems.length">
          · {{ localItems.length }}</span
        ></UButton
      >
    </div>
    <p v-if="match" class="online-danmaku-match text-muted">
      {{ mode === "online" ? "当前匹配" : "上次匹配" }}：{{ match.animeTitle
      }}<template v-if="match.seasonTitle"> · {{ match.seasonTitle }}</template>
      · {{ match.episodeTitle }}
    </p>
    <p
      v-if="serviceMessage && !service?.available"
      class="online-danmaku-note text-muted"
    >
      {{ serviceMessage }}
    </p>
    <div class="danmaku-controls">
      <label class="button secondary file-button"
        ><UIcon aria-hidden="true" name="i-lucide-upload" :size="16" />导入弹幕<input
          type="file"
          accept=".xml,.json"
          aria-label="导入弹幕文件"
          :disabled="!ready"
          @change="uploadFile"
      ></label>
      <label
        >时间偏移<input
          :value="settings.danmakuOffset"
          type="number"
          min="-300"
          max="300"
          aria-label="弹幕时间偏移"
          @change="offsetChanged"
        >秒</label
      >
      <label
        >倍速<USelect
          :model-value="settings.rate"
          aria-label="播放倍速"
          :items="
            [0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => ({
              label: value + '×',
              value,
            }))
          "
          @update:model-value="changeSettings({ rate: Number($event) })"
      /></label>
    </div>
    <p class="online-danmaku-note text-muted">
      在线弹幕由
      <a
        href="https://www.dandanplay.com"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary"
        >弹弹play开放弹幕网络</a
      >
      提供。匹配和导入文件保存在本地。
    </p>
    <UModal
      v-model:open="pickerOpen"
      title="选择弹幕库"
      :description="`当前：${subject?.name || ''} · 第 ${episode?.sort ?? ''} 话。请核对季度和集数。`"
      :ui="{ content: 'max-w-2xl' }"
    >
      <template #body>
        <form
          class="danmaku-search-form"
          @submit.prevent="search(keyword.trim(), episodeFilter.trim())"
        >
          <UInput
            v-model="keyword"
            aria-label="弹幕番剧关键词"
            placeholder="番剧名，可尝试原文名称"
            :maxlength="100"
            class="min-w-0 flex-1"
          />
          <UInput
            v-model="episodeFilter"
            aria-label="弹幕集数筛选"
            placeholder="集数，可留空"
            :maxlength="5"
            class="danmaku-episode-filter"
          />
          <UButton
            type="submit"
            :loading="searching"
            :disabled="keyword.trim().length < 2"
            >搜索</UButton
          >
        </form>
        <p class="text-muted text-sm mt-3" role="status">
          {{ searching ? "正在查找弹幕库…" : searchMessage }}
        </p>
        <p v-if="busy" class="text-muted text-sm mt-3" role="status">
          正在加载选中的弹幕…
        </p>
        <p
          v-if="!busy && pickerOpen && message"
          class="text-muted text-sm mt-2"
        >
          {{ message }}
        </p>
        <div class="danmaku-match-list">
          <UButton
            v-for="candidate in matches"
            :key="candidate.episodeId"
            color="neutral"
            variant="soft"
            class="danmaku-match-option"
            :disabled="busy"
            @click="choose(candidate)"
          >
            <span
              ><strong>{{ candidate.animeTitle }}</strong
              ><small class="text-muted"
                ><template v-if="candidate.seasonTitle"
                  >{{ candidate.seasonTitle }} · </template
                >{{ candidate.episodeTitle
                }}<template v-if="candidate.episodeNumber">
                  · {{ candidate.episodeNumber }}</template
                ></small
              ></span
            >
            <UIcon v-if=" mode === 'online' && match?.episodeId === candidate.episodeId " name="i-lucide-check" /><UIcon v-else name="i-lucide-chevron-right" />
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>

<style scoped>
.online-danmaku-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0 12px;
}
.online-danmaku-match,
.online-danmaku-note {
  font-size: 12px;
  line-height: 1.8;
  overflow-wrap: anywhere;
  margin-top: 12px;
}
.danmaku-search-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.danmaku-episode-filter {
  width: 130px;
}
.danmaku-match-list {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}
.danmaku-match-option {
  border-radius: 18px;
  justify-content: space-between;
  white-space: normal;
  text-align: left;
  padding: 12px 16px;
}
.danmaku-match-option > span:first-child {
  min-width: 0;
  display: grid;
  gap: 5px;
  overflow-wrap: anywhere;
}
.danmaku-match-option small {
  font-weight: 400;
}
@media (max-width: 540px) {
  .danmaku-search-form > :first-child {
    flex-basis: 100%;
  }
  .danmaku-episode-filter {
    flex: 1;
  }
}
</style>
