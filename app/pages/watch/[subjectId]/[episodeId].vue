<script setup lang="ts">
import type {
  Danmaku,
  PlaybackDescriptor,
  ResourceCandidate,
  ResourceResult,
  WatchProgress,
  VideoSourceInfo,
  SourceCheck,
} from "#shared/types/media";
import {
  defaultSettings,
  formatTime,
  progressKey,
  safeMediaUrl,
} from "#shared/utils/media";
import * as library from "../../../repositories/local-library";

const route = useRoute();
const subjectId = Number(route.params.subjectId);
const episodeId = Number(route.params.episodeId);
const key = progressKey(subjectId, episodeId);
const { data: subject, error: subjectError } = await useFetch(
  `/api/subjects/${subjectId}`,
);
const { data: episodes, error: episodesError } = await useFetch(
  `/api/subjects/${subjectId}/episodes`,
);
const episode = computed(() =>
  episodes.value?.find((ep) => ep.id === episodeId),
);
const { storageError, refresh: refreshHistory } = useLocalLibrary();
const settings = ref({ ...defaultSettings });
const resources = shallowRef<ResourceCandidate[]>([]);
const active = shallowRef<ResourceCandidate>();
const descriptor = shallowRef<PlaybackDescriptor>();
const loading = ref(true);
const resourceMessage = ref("");
const errorMessage = ref("");
const startTime = ref(0);
const savedPosition = ref(0);
const hasRecord = ref(false);
const completed = ref(false);
const preferredChannel = ref("");
const preferredSource = ref("");
const { enabledIds, initialize: initializeSources } = useSourcePreferences();
const sourceCatalog = shallowRef<VideoSourceInfo[]>([]);
const sourceChecks = ref<Record<string, SourceCheck>>({});
const discovering = ref(false);
const finishedSources = ref(0);
const totalSources = ref(0);
const sourceFilter = ref("all");
const filteredResources = computed(() =>
  resources.value.filter(
    (row) =>
      sourceFilter.value === "all" || row.sourceId === sourceFilter.value,
  ),
);
const resourceSources = computed(() =>
  sourceCatalog.value.filter((source) =>
    resources.value.some((row) => row.sourceId === source.id),
  ),
);
const statusLabels = {
  searchable: "有线路",
  empty: "无匹配",
  challenge: "需验证",
  unavailable: "暂不可用",
  unsupported: "需适配",
  unverified: "已配置",
};
const player = ref<{ flush: () => void; position: () => number }>();
const localUrl = ref("");
const localFormat = ref<"mp4" | "hls">("mp4");
const showLocal = ref(false);
const danmaku = shallowRef<Danmaku[]>([]);
let session = 0;
let alive = true;
let controller: AbortController | undefined;
let discoveryController: AbortController | undefined;
let discoverySession = 0;
const attempts = new Set<string>();
const relevantEpisodes = computed(
  () => episodes.value?.filter((e) => e.type === episode.value?.type) || [],
);
const currentIndex = computed(() =>
  relevantEpisodes.value.findIndex((e) => e.id === episodeId),
);
const previous = computed(() => relevantEpisodes.value[currentIndex.value - 1]);
const next = computed(() => relevantEpisodes.value[currentIndex.value + 1]);
useSeoMeta({
  title: () =>
    `${subject.value?.name || "正在播放"} · 第 ${episode.value?.sort || ""} 话 — Mamba-Animation`,
});
definePageMeta({ key: (route) => route.path });

function errorText(error: unknown) {
  const e = error as { data?: { message?: string }; message?: string };
  return e.data?.message || e.message || "暂时无法连接，请稍后重试。";
}

async function selectResource(resource: ResourceCandidate, automatic = false) {
  if (resource.match === "confirm" && automatic) return;
  player.value?.flush();
  const position = player.value?.position();
  if (typeof position === "number") startTime.value = position;
  const request = ++session;
  controller?.abort();
  controller = new AbortController();
  active.value = resource;
  attempts.add(resource.id);
  descriptor.value = undefined;
  loading.value = true;
  errorMessage.value = "";
  try {
    const result = await $fetch<PlaybackDescriptor>("/api/playback/resolve", {
      method: "POST",
      body: { resourceId: resource.id },
      signal: controller.signal,
      timeout: 15000,
      retry: 0,
    });
    if (!alive || request !== session) return;
    descriptor.value = result;
  } catch (error) {
    if (alive && request === session) {
      errorMessage.value = errorText(error);
      if (automatic) fatal(errorMessage.value);
    }
  } finally {
    if (alive && request === session) loading.value = false;
  }
}

async function loadResources(auto = true) {
  const request = ++discoverySession;
  discoveryController?.abort();
  const abort = new AbortController();
  discoveryController = abort;
  loading.value = !descriptor.value;
  discovering.value = true;
  resources.value = [];
  sourceChecks.value = {};
  sourceFilter.value = "all";
  finishedSources.value = 0;
  attempts.clear();
  let autoStarted = false;
  try {
    const catalog = await $fetch("/api/sources", {
      signal: abort.signal,
      timeout: 10000,
      retry: 0,
    });
    if (!alive || request !== discoverySession) return;
    sourceCatalog.value = catalog.sources;
    initializeSources(catalog.sources);
    const list = catalog.enabled
      ? catalog.sources
        .filter((source) => enabledIds.value?.includes(source.id))
        .sort(
          (a, b) =>
            Number(b.id === preferredSource.value) -
            Number(a.id === preferredSource.value) || a.tier - b.tier,
        )
      : [];
    totalSources.value = list.length;
    if (!list.length) {
      resourceMessage.value = catalog.enabled
        ? "没有启用在线源，可前往播放源管理开启，或添加自己的视频地址。"
        : "此站点已关闭在线源，你可以添加自己的视频地址。";
      return;
    }
    let cursor = 0;
    let preferredSettled = !list.some(
      (source) => source.id === preferredSource.value,
    );
    resourceMessage.value = `正在检索 0 / ${list.length} 个源…`;
    await Promise.all(
      Array.from({ length: Math.min(3, list.length) }, async () => {
        while (
          cursor < list.length &&
          alive &&
          request === discoverySession &&
          !abort.signal.aborted
        ) {
          const source = list[cursor++]!;
          try {
            const result = await $fetch<ResourceResult>(
              `/api/episodes/${episodeId}/resources`,
              {
                query: { source: source.id },
                signal: abort.signal,
                timeout: 30000,
                retry: 0,
              },
            );
            if (!alive || request !== discoverySession) return;
            if (result.source) sourceChecks.value[source.id] = result.source;
            resources.value = [...resources.value, ...result.resources].sort(
              (a, b) =>
                (sourceCatalog.value.find((s) => s.id === a.sourceId)?.tier ||
                  0) -
                (sourceCatalog.value.find((s) => s.id === b.sourceId)?.tier ||
                  0),
            );
          } catch (error) {
            if (!alive || request !== discoverySession) return;
            sourceChecks.value[source.id] = {
              id: source.id,
              state: "unavailable",
              count: 0,
              checkedAt: Date.now(),
              message: errorText(error),
            };
          } finally {
            if (alive && request === discoverySession) {
              if (source.id === preferredSource.value) preferredSettled = true;
              const first =
                resources.value.find(
                  (r) =>
                    r.match === "exact" &&
                    r.sourceId === preferredSource.value &&
                    r.channel === preferredChannel.value &&
                    !attempts.has(r.id),
                ) ||
                resources.value.find(
                  (r) => r.match === "exact" && !attempts.has(r.id),
                );
              if (
                auto &&
                preferredSettled &&
                first &&
                !autoStarted &&
                !active.value &&
                !descriptor.value
              ) {
                autoStarted = true;
                void selectResource(first, true);
              } else if (
                autoStarted &&
                !descriptor.value &&
                !loading.value &&
                first
              )
                void selectResource(first, true);
              finishedSources.value++;
              resourceMessage.value = `正在检索 ${finishedSources.value} / ${list.length} 个源 · 已找到 ${resources.value.length} 条线路`;
            }
          }
        }
      }),
    );
    if (alive && request === discoverySession)
      resourceMessage.value = resources.value.length
        ? `已检索 ${list.length} 个源，找到 ${resources.value.length} 条候选线路。无法播放时可换线。`
        : `已检索 ${list.length} 个源，暂无匹配线路。可以检查源状态或添加自己的视频地址。`;
  } catch (error) {
    if (alive && request === discoverySession)
      resourceMessage.value = errorText(error);
  } finally {
    if (alive && request === discoverySession) {
      discovering.value = false;
      if (!autoStarted && !descriptor.value) loading.value = false;
    }
  }
}

function fatal(message: string) {
  errorMessage.value = message;
  const alternative = resources.value.find(
    (r) => r.match === "exact" && !attempts.has(r.id),
  );
  if (alternative && active.value?.sourceId !== "local")
    void selectResource(alternative, true);
}

async function save(
  position: number,
  duration: number,
  ended: boolean,
  source?: { sourceId: string; channel: string },
) {
  if (!subject.value || !episode.value) return;
  const row: WatchProgress = {
    key,
    subjectId,
    episodeId,
    subjectName: subject.value.name,
    episodeName: episode.value.name,
    image: subject.value.image,
    sort: episode.value.sort,
    position,
    duration,
    completed: ended,
    updatedAt: Date.now(),
    sourceId: source?.sourceId ?? active.value?.sourceId ?? "",
    channel: source?.channel ?? descriptor.value?.channel ?? "",
  };
  try {
    await library.saveProgress(row);
    savedPosition.value = position;
    hasRecord.value = true;
    if (ended) completed.value = true;
    storageError.value = "";
  } catch {
    storageError.value = "观看记录保存失败。请检查浏览器存储空间或权限。";
  }
}
async function markCompleted() {
  if (!subject.value || !episode.value) return;
  try {
    if (!hasRecord.value)
      await library.saveProgress({
        key,
        subjectId,
        episodeId,
        subjectName: subject.value.name,
        episodeName: episode.value.name,
        image: subject.value.image,
        sort: episode.value.sort,
        position: 0,
        duration: 0,
        completed: false,
        updatedAt: Date.now(),
        sourceId: active.value?.sourceId || "",
        channel: descriptor.value?.channel || "",
      });
    await library.setCompleted(key, !completed.value);
    completed.value = !completed.value;
    hasRecord.value = true;
  } catch {
    storageError.value = "已看状态保存失败。";
  }
}
async function preferences(value: typeof settings.value) {
  settings.value = value;
  try {
    await library.saveSettings({ ...value });
  } catch {
    storageError.value = "偏好设置保存失败。";
  }
}
async function useLocal() {
  try {
    const url = safeMediaUrl(localUrl.value.trim());
    player.value?.flush();
    const position = player.value?.position();
    if (typeof position === "number") startTime.value = position;
    ++session;
    controller?.abort();
    active.value = {
      id: "local",
      sourceId: "local",
      sourceName: "本地添加",
      subjectName: subject.value?.name || "",
      episodeName: episode.value?.name || "",
      channel: "自定义地址",
      match: "exact",
    };
    descriptor.value = {
      url,
      transport: localFormat.value,
      sourceName: "本地添加",
      channel: "自定义地址",
    };
    loading.value = false;
    errorMessage.value = "";
    try {
      await library.saveBinding(key, url, localFormat.value);
    } catch {
      storageError.value = "地址未能保存到本地，本次仍可播放。";
    }
    showLocal.value = false;
  } catch (error) {
    errorMessage.value = errorText(error);
  }
}
onMounted(async () => {
  if (!episode.value) {
    loading.value = false;
    resourceMessage.value = "没有找到此番剧的对应章节。";
    return;
  }
  try {
    const [recordResult, preferencesResult, bindingResult] =
      await Promise.allSettled([
        library.getProgress(key),
        library.getSettings(),
        library.getBinding(key),
      ]);
    if (!alive) return;
    if (preferencesResult.status === "fulfilled")
      settings.value = preferencesResult.value;
    if (
      [recordResult, preferencesResult, bindingResult].some(
        (result) => result.status === "rejected",
      )
    )
      storageError.value = "部分本地数据无法读取，播放仍可继续。";
    const record =
      recordResult.status === "fulfilled" ? recordResult.value : undefined;
    const binding =
      bindingResult.status === "fulfilled" ? bindingResult.value : undefined;
    if (record) {
      startTime.value = record.position;
      savedPosition.value = record.position;
      hasRecord.value = true;
      completed.value = record.completed;
      preferredChannel.value = record.channel;
      preferredSource.value = record.sourceId;
    }
    if (binding) {
      localUrl.value = binding.url;
      localFormat.value = binding.transport;
      await useLocal();
    }
  } catch {
    storageError.value = "本地记录无法读取，本次播放可能无法续播。";
  }
  if (alive) await loadResources(!descriptor.value);
});
onBeforeRouteLeave(() => {
  player.value?.flush();
});
onBeforeUnmount(() => {
  player.value?.flush();
  alive = false;
  ++session;
  controller?.abort();
  ++discoverySession;
  discoveryController?.abort();
  void refreshHistory();
});
</script>
<template>
  <div class="page watch-page">
    <NuxtLink :to="`/subject/${subjectId}`" class="back-link">
      <UIcon aria-hidden="true" name="i-lucide-arrow-left" :size="17" />番剧详情
    </NuxtLink>
    <FeedbackState v-if="subjectError || episodesError" title="番剧或章节暂时无法加载" description="返回详情页重新选择，或稍后刷新。" /><template
      v-else-if="subject && episode">
      <div class="watch-heading">
        <div>
          <span class="eyebrow">NOW PLAYING</span>
          <h1>{{ subject.name }}</h1>
          <p>第 {{ episode.sort }} 话<span>·</span>{{ episode.name }}</p>
        </div>
        <span class="small-pill">{{
          descriptor?.transport.toUpperCase() || "ONLINE"
        }}</span>
      </div>
      <div class="watch-layout">
        <div class="watch-main">
          <PlayerVideoPlayer
v-if="descriptor" :key="descriptor.url" ref="player" :descriptor="descriptor"
            :source-id="active?.sourceId" :start-time="startTime" :settings="settings" :danmaku="danmaku"
            @progress="save" @fatal="fatal" @settings="preferences" />
          <div v-else class="player-placeholder">
            <UIcon
aria-hidden="true" :name="loading ? 'i-lucide-refresh-cw' : 'i-lucide-monitor-play'"
              :class="{ spinning: loading }" :size="36" /><strong>{{
                loading ? "正在寻找可播放的线路…" : "选择一条线路，开始观看"
              }}</strong>
            <p>
              {{
                errorMessage ||
                resourceMessage ||
                "也可以添加自己的 HTTPS 视频地址。"
              }}
            </p>
          </div>
          <div class="player-toolbar">
            <span class="saved-status">
              <UIcon aria-hidden="true" name="i-lucide-shield-check" :size="15" />{{
                hasRecord
                  ? `已保存到 ${formatTime(savedPosition)}`
                  : "播放后自动保存进度"
              }}
            </span>
            <div>
              <UButton
color="neutral" variant="soft" class="text-link" :class="{ 'accent-text': completed }"
                @click="markCompleted">
                <UIcon aria-hidden="true" name="i-lucide-check" :size="16" />{{
                  completed ? "已看完" : "标记已看"
                }}
              </UButton>
              <NuxtLink v-if="previous" :to="`/watch/${subjectId}/${previous.id}`" class="icon-button" aria-label="上一集">
                <UIcon aria-hidden="true" name="i-lucide-chevron-left" :size="20" />
              </NuxtLink>
              <NuxtLink v-if="next" :to="`/watch/${subjectId}/${next.id}`" class="text-link">下一集
                <UIcon aria-hidden="true" name="i-lucide-chevron-right" :size="17" />
              </NuxtLink>
            </div>
          </div>
          <p v-if="storageError" class="notice warning" role="alert">
            {{ storageError }}
          </p>
          <p v-if="errorMessage && !loading" class="notice warning" role="alert">
            {{ errorMessage }}
          </p>
          <section class="panel source-panel">
            <div class="panel-heading">
              <h2>
                <UIcon aria-hidden="true" name="i-lucide-monitor-play" :size="18" />播放线路
              </h2>
              <UButton
color="neutral" variant="soft" class="text-link" :disabled="discovering"
                @click="loadResources(false)">
                <UIcon aria-hidden="true" name="i-lucide-refresh-cw" :size="15" />刷新
              </UButton>
            </div>
            <p v-if="resourceMessage" class="muted">{{ resourceMessage }}</p>
            <div class="source-filters">
              <UButton size="xs" :variant="sourceFilter === 'all' ? 'solid' : 'soft'" @click="sourceFilter = 'all'">全部
                {{ resources.length }}</UButton>
              <UButton
v-for="source in resourceSources" :key="source.id" size="xs"
                :variant="sourceFilter === source.id ? 'solid' : 'soft'" @click="sourceFilter = source.id">{{
                  source.name }}
                {{
                  resources.filter((row) => row.sourceId === source.id).length
                }}</UButton>
              <UButton to="/sources" color="neutral" variant="ghost" size="xs" icon="i-lucide-settings-2">管理源</UButton>
            </div>
            <div class="source-list">
              <UButton
v-for="resource in filteredResources" :key="resource.id" color="neutral" variant="soft"
                class="source-button" :class="{ selected: active?.id === resource.id }"
                @click="selectResource(resource)">
                <span class="source-dot" /><span><strong>{{ resource.sourceName }} · {{ resource.channel
                    }}</strong><small>{{
                      resource.match === "confirm"
                        ? `请确认：${resource.subjectName} · ${resource.episodeName}`
                        : resource.episodeName
                    }}</small></span>
                <UIcon
aria-hidden="true" :name="active?.id === resource.id ? 'i-lucide-check' : 'i-lucide-play'"
                  :size="16" />
              </UButton>
            </div>
            <div class="source-checks" aria-live="polite">
              <span v-for="check in Object.values(sourceChecks)" :key="check.id" :title="check.message">{{
                sourceCatalog.find((source) => source.id === check.id)?.name
              }}
                · {{ statusLabels[check.state] }}</span>
            </div>
            <UButton color="neutral" variant="soft" class="text-link add-local" @click="showLocal = !showLocal">
              <UIcon aria-hidden="true" :name="showLocal ? 'i-lucide-x' : 'i-lucide-plus'" :size="16" />{{
                showLocal ? "收起" : "添加自己的视频地址"
              }}
            </UButton>
            <form v-if="showLocal" class="local-source-form" @submit.prevent="useLocal">
              <label for="local-url">HTTPS 视频地址，仅保存在这台设备</label>
              <UInput id="local-url" v-model="localUrl" type="url" required placeholder="https://…/video.m3u8" />
              <div>
                <USelect
v-model="localFormat" :items="[
                  { label: 'MP4', value: 'mp4' },
                  { label: 'HLS / m3u8', value: 'hls' },
                ]" aria-label="视频格式" />
                <UButton type="submit"> 使用这个地址 </UButton>
              </div>
              <p class="muted">
                地址需允许浏览器播放。HLS 还需要上游允许跨域请求。
              </p>
            </form>
          </section>
          <PlayerDanmakuPanel
:storage-key="key" :subject="subject" :episode="episode" :settings="settings"
            @items="danmaku = $event" @settings="preferences" />
        </div>
        <aside class="panel watch-episodes">
          <div class="panel-heading">
            <h2>选集</h2>
            <span class="muted">{{ relevantEpisodes.length }} 话</span>
          </div>
          <div class="watch-episode-list">
            <NuxtLink
v-for="ep in relevantEpisodes" :key="ep.id" :to="`/watch/${subjectId}/${ep.id}`"
              :class="{ active: ep.id === episodeId }"><span>{{ String(ep.sort).padStart(2, "0") }}</span><strong>{{
                ep.name }}</strong>
              <UIcon v-if="ep.id === episodeId" aria-hidden="true" name="i-lucide-play" :size="15" />
            </NuxtLink>
          </div>
        </aside>
      </div>
      <EpisodeComments :episode-id="episodeId" :episode-title="`第 ${episode?.sort ?? ''} 话 · ${episode?.name || ''}`" />
    </template>
    <FeedbackState v-else-if="!loading" title="没有找到对应章节" description="请返回番剧详情重新选择。" />
  </div>
</template>
