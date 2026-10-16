<script setup lang="ts">
import { formatTime } from "#shared/utils/media";
const { records, ready, storageError, refresh, remove, toggleCompleted } =
  useLocalLibrary();
const filter = ref("all");
const visible = computed(() =>
  records.value.filter(
    (row) =>
      filter.value === "all" ||
      (filter.value === "completed" ? row.completed : !row.completed),
  ),
);
onMounted(refresh);
useSeoMeta({ title: "观看记录 — Ani" });
function date(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
</script>
<template>
  <div class="page">
    <div class="page-intro">
      <div>
        <span class="eyebrow">EVERY STORY LEAVES A TRACE</span>
        <h1>看过的，都记得<span class="accent-dot">。</span></h1>
        <p class="page-subtitle">
          记录只保存在这个浏览器，换一台设备可通过导入记录继续。
        </p>
      </div>
      <UButton to="/settings" color="neutral" variant="soft"
        ><AppIcon name="Download" :size="16" />管理记录</UButton
      >
    </div>
    <p v-if="storageError" class="notice warning" role="alert">
      {{ storageError }}
    </p>
    <SegmentedControl
      v-model="filter"
      :items="[
        { label: '全部记录 · ' + records.length, value: 'all' },
        { label: '还在看', value: 'watching' },
        { label: '已看完', value: 'completed' },
      ]"
      label="筛选观看记录"
    />
    <FeedbackState
      v-if="!ready"
      title="正在读取本地记录…"
      loading
    /><FeedbackState
      v-else-if="!visible.length"
      title="故事，还没开始"
      description="找一部喜欢的番剧，开始后这里会自动记录。"
    />
    <div v-else class="history-list">
      <article v-for="row in visible" :key="row.key" class="history-row">
        <NuxtLink
          :to="`/watch/${row.subjectId}/${row.episodeId}`"
          class="history-poster"
          ><AnimeCover
            :src="row.image"
            :width="92"
            :height="130"
            sizes="70px md:92px"
            :alt="row.subjectName"
            referrerpolicy="no-referrer" /><span
            ><AppIcon name="Play" :size="20" /></span
        ></NuxtLink>
        <div class="history-info">
          <NuxtLink :to="`/watch/${row.subjectId}/${row.episodeId}`"
            ><h2>{{ row.subjectName }}</h2></NuxtLink
          >
          <p>第 {{ row.sort }} 话<span>·</span>{{ row.episodeName }}</p>
          <div class="history-progress">
            <div class="mini-progress">
              <i
                :style="{
                  width: `${Math.min(100, row.duration ? (row.position / row.duration) * 100 : 0)}%`,
                }"
              />
            </div>
            <small>{{
              row.completed
                ? "已看完"
                : `${formatTime(row.position)} / ${formatTime(row.duration)}`
            }}</small>
          </div>
          <time>{{ date(row.updatedAt) }}</time>
        </div>
        <div class="history-actions">
          <UButton
            color="neutral"
            variant="soft"
            class="icon-button"
            :class="{ 'accent-text': row.completed }"
            :aria-label="row.completed ? '取消已看' : '标记已看'"
            @click="toggleCompleted(row)"
          >
            <AppIcon name="Check" :size="18" /></UButton
          ><UButton
            color="neutral"
            variant="soft"
            class="icon-button"
            :aria-label="`删除 ${row.subjectName} 第 ${row.sort} 话的记录`"
            @click="remove(row.key)"
          >
            <AppIcon name="Trash2" :size="17" />
          </UButton>
        </div>
      </article>
    </div>
  </div>
</template>
