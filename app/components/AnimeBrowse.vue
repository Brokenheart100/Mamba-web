<script setup lang="ts">
import { currentSeason, discoveryQuerySchema } from "#shared/schemas/discovery";
import { categoryMaxResults, categoryPageSize, categorySorts } from "#shared/constants/categories";
const props = defineProps<{ mode: "season" | "ranking" }>();
const route = useRoute();
const path = computed(() => props.mode === "season" ? "/seasons" : "/rankings");
const parsed = computed(() => discoveryQuerySchema.safeParse({ ...route.query, mode: props.mode }));
const filters = computed(() => parsed.value.success ? parsed.value.data : discoveryQuerySchema.parse({ mode: props.mode }));
const years = computed(() => [...(props.mode === "ranking" ? ["全部"] : []), ...Array.from({ length: Number(currentSeason().year) - 1989 }, (_, index) => String(Number(currentSeason().year) - index))]);
const quarters = [{ label: "冬季 · 1—3 月", value: "1" }, { label: "春季 · 4—6 月", value: "2" }, { label: "夏季 · 7—9 月", value: "3" }, { label: "秋季 · 10—12 月", value: "4" }];
const { data, status, error, refresh } = await useFetch("/api/subjects/browse", { query: filters, dedupe: "cancel" });
function select(key: "year" | "quarter" | "sort", value: unknown) {
  if (typeof value === "string") return navigateTo({ path: path.value, query: { ...filters.value, [key]: value, page: "1" } });
}
function pageLink(page: number) { return { path: path.value, query: { ...filters.value, page: String(page) } }; }
const total = computed(() => Math.min(data.value?.total || 0, categoryMaxResults));
useSeoMeta({ title: () => `${props.mode === "season" ? "季度新番" : "动画榜单"} — Mamba-Animation` });
</script>
<template>
  <div class="page">
    <div class="page-intro">
      <div>
        <span class="eyebrow">{{ mode === 'season' ? 'A NEW SEASON, A NEW STORY' : 'STORIES THAT STAY WITH US' }}</span>
        <h1>{{ mode === 'season' ? '这一季，心动开场' : '好故事，经得起回味' }}<span class="accent-dot">。</span></h1>
        <p class="page-subtitle">{{ mode === 'season' ? '按完整季度发现新动画，提前留下一份期待。' : '按 Bangumi 官方排名浏览动画，找到值得补完的作品。' }}</p>
      </div>
      <UButton to="/categories" color="neutral" variant="soft" icon="i-lucide-layout-grid">更多分类</UButton>
    </div>
    <UAlert v-if="!parsed.success" color="warning" variant="soft" title="筛选链接无效，已恢复默认条件。" class="mb-5" />
    <GlassCard class="p-5 mb-7">
      <div class="flex flex-wrap items-end gap-4">
        <UFormField label="年份" class="min-w-28 flex-1 sm:flex-none"><USelect :model-value="filters.year" :items="years" aria-label="年份" class="w-full" @update:model-value="select('year', $event)" /></UFormField>
        <UFormField v-if="mode === 'season'" label="季度" class="min-w-40 flex-1 sm:flex-none"><USelect :model-value="filters.quarter" :items="quarters" aria-label="季度" class="w-full" @update:model-value="select('quarter', $event)" /></UFormField>
        <UFormField v-if="mode === 'season'" label="排序" class="min-w-28 flex-1 sm:flex-none"><USelect :model-value="filters.sort" :items="categorySorts" aria-label="排序" class="w-full" @update:model-value="select('sort', $event)" /></UFormField>
        <UButton :to="path" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw">重置</UButton>
        <span class="text-xs text-muted sm:ml-auto" aria-live="polite">{{ status === 'pending' ? '正在寻找好故事…' : data ? `共 ${data.total} 部动画` : '' }}</span>
      </div>
    </GlassCard>
    <div v-if="status === 'pending'" class="subject-grid" aria-busy="true"><USkeleton v-for="index in 12" :key="index" class="aspect-[3/5] rounded-3xl" /></div>
    <FeedbackState v-else-if="error" title="动画资料暂时无法加载" retry @retry="refresh()" />
    <template v-else-if="data">
      <div v-if="data.data.length" class="subject-grid"><div v-for="subject in data.data" :key="subject.id" class="min-w-0"><UBadge v-if="mode === 'ranking' && subject.rank" color="primary" variant="soft" class="mb-2">#{{ subject.rank }}</UBadge><SubjectCard :subject="subject" /></div></div>
      <FeedbackState v-else title="这份片单，还在等待开场" description="试试其他年份或季度。" />
      <nav v-if="total > categoryPageSize" class="flex justify-center mt-8" aria-label="动画列表分页"><UPagination :page="filters.page" :total="total" :items-per-page="categoryPageSize" :sibling-count="1" :show-edges="false" :to="pageLink" color="neutral" variant="soft" /></nav>
      <p v-if="data.total > categoryMaxResults" class="text-center text-xs text-muted mt-4">展示前 {{ categoryMaxResults }} 个结果，可选择年份缩小范围。</p>
    </template>
  </div>
</template>
