<script setup lang="ts">
import { formatTime } from "#shared/utils/media";
const route = useRoute();
const id = computed(() => Number(route.params.id));
const {
  data: subject,
  error,
  refresh,
} = await useFetch(() => `/api/subjects/${id.value}`);
const {
  data: episodes,
  error: episodesError,
  refresh: refreshEpisodes,
} = await useFetch(() => `/api/subjects/${id.value}/episodes`);
const { records, refresh: refreshHistory } = useLocalLibrary();
onMounted(refreshHistory);
const tab = ref(0);
const tabs = computed(() => [
  ...new Set((episodes.value || []).map((ep) => ep.type)),
]);
const visible = computed(
  () => episodes.value?.filter((ep) => ep.type === tab.value) || [],
);
const progress = computed(
  () =>
    new Map(
      records.value
        .filter((row) => row.subjectId === id.value)
        .map((row) => [row.episodeId, row]),
    ),
);
const last = computed(() =>
  records.value.find((row) => row.subjectId === id.value),
);
const first = computed(
  () => episodes.value?.find((ep) => ep.type === 0) || episodes.value?.[0],
);
const typeNames: Record<number, string> = {
  0: "正片",
  1: "特别篇",
  2: "片头",
  3: "片尾",
  4: "PV",
  5: "MAD",
  6: "其他",
};
useSeoMeta({ title: () => `${subject.value?.name || "番剧详情"} — Ani` });
</script>
<template>
  <div class="page detail-page">
    <NuxtLink to="/" class="back-link">
      <AppIcon name="ArrowLeft" :size="17" />返回发现
    </NuxtLink>
    <FeedbackState v-if="error" title="暂时无法打开这部番剧" retry @retry="refresh()" /><template v-else-if="subject">
      <section class="detail-hero">
        <div class="detail-poster">
          <AnimeCover :src="subject.image" sizes="180px md:300px" loading="eager" :alt="subject.name"
            referrerpolicy="no-referrer" />
        </div>
        <div class="detail-content">
          <span class="eyebrow">A STORY WAITING FOR YOU</span>
          <div class="detail-meta">
            <span>{{ subject.platform }}</span><span>{{ subject.date || "放送日期待定" }}</span><span
              v-if="subject.episodes">全 {{ subject.episodes }} 话</span>
          </div>
          <h1>{{ subject.name }}</h1>
          <p class="original-title">{{ subject.originalName }}</p>
          <div class="rating-row">
            <strong>★ {{ subject.score ? subject.score.toFixed(1) : "—" }}</strong><span>Bangumi 评分</span><span
              v-if="subject.rank">排名 #{{ subject.rank }}</span>
          </div>
          <div class="tag-list">
            <span v-for="tag in subject.tags.slice(0, 6)" :key="tag">{{
              tag
              }}</span>
          </div>
          <UButton v-if="last || first" :to="`/watch/${id}/${last?.episodeId || first?.id}`" color="primary"
            variant="solid">
            <AppIcon name="Play" :size="18" />{{
              last
                ? `继续第 ${last.sort} 话 · ${formatTime(last.position)}`
                : "开始观看"
            }}
            <AppIcon name="ArrowRight" :size="17" />
          </UButton>
          <p class="detail-note">
            <AppIcon name="ShieldCheck" :size="14" />观看进度仅保存在你的浏览器
          </p>
        </div>
      </section>
      <section class="section synopsis">
        <div class="section-heading">
          <h2>关于这个故事</h2>
          <a :href="`https://bgm.tv/subject/${id}`" target="_blank" rel="noopener noreferrer" class="text-link">Bangumi
            详情
            <AppIcon name="ArrowUpRight" :size="15" />
          </a>
        </div>
        <p>{{ subject.summary || "这部番剧暂时没有简介。" }}</p>
      </section>
      <section class="section">
        <div class="section-heading">
          <h2>
            选择章节<span class="count-label">{{ episodes?.length || 0 }}</span>
          </h2>
          <span class="muted">在线资源将在选集后查找</span>
        </div>
        <FeedbackState v-if="episodesError" title="章节暂时无法加载" retry @retry="refreshEpisodes()" /><template v-else>
          <SegmentedControl v-model="tab" :items="tabs.map((type) => ({
            label: typeNames[type] || '其他',
            value: type,
          }))
            " label="章节分类" />
          <div class="episode-grid">
            <NuxtLink v-for="episode in visible" :key="episode.id" :to="`/watch/${id}/${episode.id}`"
              class="episode-tile" :class="{ watched: progress.get(episode.id)?.completed }"><span
                class="episode-number">{{ episode.type === 0 ? "EP" : "SP" }}
                {{ String(episode.sort).padStart(2, "0")
                }}
                <AppIcon v-if="progress.get(episode.id)?.completed" name="Check" :size="14" />
                <AppIcon v-else name="Play" :size="14" />
              </span><strong>{{ episode.name }}</strong><small>{{
                progress.get(episode.id)
                  ? progress.get(episode.id)?.completed
                    ? "已看完"
                    : `看到 ${formatTime(progress.get(episode.id)!.position)}`
                  : episode.airdate || "日期待定"
              }}</small></NuxtLink>
          </div>
          <FeedbackState v-if="episodes && !episodes.length" title="章节尚未公布" description="可以稍后再来查看。" />
        </template>
      </section>
    </template>
  </div>
</template>
