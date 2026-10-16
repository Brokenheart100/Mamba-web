<script setup lang="ts">
import type { SourceState, VideoSourceInfo } from "#shared/types/media";
const { data, error, refresh } = await useFetch("/api/sources");
const {
  enabledIds,
  statuses,
  preferenceError,
  initialize,
  setEnabled,
  setDefaults,
} = useSourcePreferences();
const checking = ref<string[]>([]);
const checkingAll = ref(false);
const search = ref("");
const sources = computed(() => data.value?.sources || []);
const visible = computed(() =>
  sources.value.filter((source) =>
    source.name.toLowerCase().includes(search.value.trim().toLowerCase()),
  ),
);
const labels: Record<SourceState, string> = {
  searchable: "可检索",
  empty: "未匹配",
  challenge: "需验证",
  unavailable: "暂不可用",
  unsupported: "需适配",
  unverified: "已配置",
};
const colors: Record<SourceState, "success" | "warning" | "neutral" | "error"> =
  {
    searchable: "success",
    empty: "neutral",
    challenge: "warning",
    unavailable: "error",
    unsupported: "warning",
    unverified: "neutral",
  };
onMounted(() => initialize(sources.value));
watch(sources, (value) => initialize(value));
useSeoMeta({ title: "播放源 — Ani" });
async function check(source: VideoSourceInfo) {
  if (checking.value.includes(source.id)) return;
  checking.value.push(source.id);
  try {
    const result = await $fetch(`/api/sources/${source.id}/check`, {
      method: "POST",
      timeout: 15000,
      retry: 0,
    });
    statuses.value = {
      ...statuses.value,
      [source.id]: result,
    };
  } catch {
    statuses.value = {
      ...statuses.value,
      [source.id]: {
        id: source.id,
        state: "unavailable",
        count: 0,
        checkedAt: Date.now(),
        message: "检测失败或超时，可以稍后重试。",
      },
    };
  } finally {
    checking.value = checking.value.filter((id) => id !== source.id);
  }
}
async function checkAll() {
  if (checkingAll.value) return;
  checkingAll.value = true;
  let cursor = 0;
  const list = [...sources.value];
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (cursor < list.length) await check(list[cursor++]!);
    }),
  );
  checkingAll.value = false;
}
function state(source: VideoSourceInfo) {
  return statuses.value[source.id]?.state || source.initialStatus;
}
</script>
<template>
  <div class="page sources-page">
    <div class="page-intro">
      <div>
        <span class="eyebrow">MORE WAYS TO YOUR NEXT STORY</span>
        <h1>好故事，不止一条路<span class="accent-dot">。</span></h1>
        <p class="page-subtitle">
          {{ sources.length }} 个在线源，随你选择。启用偏好只保存在这个浏览器。
        </p>
      </div>
      <UBadge variant="soft" color="primary" size="lg"
        >{{
          enabledIds?.length ?? sources.filter((s) => s.defaultEnabled).length
        }}
        个已启用</UBadge
      >
    </div>
    <UAlert
      v-if="data && !data.enabled"
      color="warning"
      variant="soft"
      title="站点暂时关闭了在线源"
      description="你仍然可以在播放页添加自己的视频地址。"
    />
    <UAlert
      v-if="preferenceError"
      color="warning"
      variant="soft"
      :description="preferenceError"
    />
    <div class="source-manager-toolbar">
      <UInput
        v-model="search"
        :disabled="enabledIds === null"
        icon="i-lucide-search"
        placeholder="查找播放源"
        aria-label="查找播放源"
        class="source-search"
      />
      <div>
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-rotate-ccw"
          :disabled="enabledIds === null"
          @click="setDefaults(sources)"
          >恢复默认</UButton
        ><UButton
          icon="i-lucide-radio"
          :loading="checkingAll"
          :disabled="enabledIds === null || (data && !data.enabled)"
          @click="checkAll"
          >检测全部</UButton
        >
      </div>
    </div>
    <FeedbackState
      v-if="error"
      title="播放源列表暂时无法读取"
      retry
      @retry="refresh()"
    />
    <div v-else class="source-manager-grid">
      <GlassCard
        v-for="(source, index) in visible"
        :key="source.id"
        class="source-card"
        interactive
      >
        <div class="source-card-heading">
          <span class="source-avatar" :class="`source-tone-${index % 5}`">{{
            source.name.slice(0, 1)
          }}</span>
          <div>
            <h2>{{ source.name }}</h2>
            <span>{{ source.website.replace(/^https?:\/\//, "") }}</span>
          </div>
          <USwitch
            :model-value="
              enabledIds?.includes(source.id) ?? source.defaultEnabled
            "
            :aria-label="`启用${source.name}`"
            :disabled="enabledIds === null || (data && !data.enabled)"
            @update:model-value="(value) => setEnabled(source.id, !!value)"
          />
        </div>
        <p class="source-description">
          {{ statuses[source.id]?.message || source.note }}
        </p>
        <div class="source-card-footer">
          <UBadge :color="colors[state(source)]" variant="soft" size="sm">{{
            labels[state(source)]
          }}</UBadge>
          <div>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-external-link"
              :to="source.website"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="`打开${source.name}`"
            /><UButton
              color="neutral"
              variant="soft"
              size="sm"
              :loading="checking.includes(source.id)"
              :disabled="enabledIds === null || (data && !data.enabled)"
              @click="check(source)"
              >检测</UButton
            >
          </div>
        </div>
      </GlassCard>
    </div>
    <UAlert
      class="source-footnote"
      color="neutral"
      variant="soft"
      icon="i-lucide-info"
      title="源状态会随上游变化"
      description="“可检索”表示能找到条目，不代表每条线路都能播放。需要验证或额外网页解析的线路会明确提示，可换线或打开源站。"
    />
  </div>
</template>
