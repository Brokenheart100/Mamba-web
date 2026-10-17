<script setup lang="ts">
import { categoryQuerySchema } from "#shared/schemas/categories";
import type { CategoryQuery } from "#shared/schemas/categories";
import { categoryFormats, categoryGenres, categoryMaxResults, categoryPageSize, categoryRegions, categorySorts } from "#shared/constants/categories";

const route = useRoute();
const parsed = computed(() => categoryQuerySchema.safeParse(route.query));
const filters = computed(() => parsed.value.success ? parsed.value.data : categoryQuerySchema.parse({}));
const years = ["全部", ...Array.from({ length: new Date().getUTCFullYear() - 1999 }, (_, index) => String(new Date().getUTCFullYear() - index)), "2000以前"];
const rows = [
  { key: "region" as const, label: "地区", items: [...categoryRegions] },
  { key: "format" as const, label: "形式", items: [...categoryFormats] },
  { key: "genre" as const, label: "题材", items: [...categoryGenres] },
  { key: "year" as const, label: "年份", items: years },
];
const selected = computed(() => rows.flatMap((row) => filters.value[row.key] === "全部"
  ? [] : [{ key: row.key, label: filters.value[row.key] }]));
const { data, status, error, refresh } = await useFetch("/api/subjects/categories", {
  query: filters,
  dedupe: "cancel",
});
function select(key: keyof Omit<CategoryQuery, "page">, value: unknown) {
  if (typeof value !== "string") return;
  return navigateTo({ path: "/categories", query: { ...filters.value, [key]: value, page: "1" } });
}
function pageLink(page: number) {
  return { path: "/categories", query: { ...filters.value, page: String(page) } };
}
const accessibleTotal = computed(() => Math.min(data.value?.total || 0, categoryMaxResults));
const radioUi = {
  fieldset: "gap-2 flex-wrap",
  legend: "sr-only",
  item: "rounded-full px-3.5 py-1.5 cursor-pointer has-data-[state=checked]:border-primary/35 has-data-[state=checked]:bg-primary/12 has-data-[state=checked]:text-primary has-focus-visible:ring-2 has-focus-visible:ring-primary",
  container: "size-0 overflow-hidden",
  wrapper: "gap-0",
  label: "text-xs text-inherit whitespace-nowrap",
};
useSeoMeta({ title: "动漫分类 — Mamba-Animation" });
</script>

<template>
  <div class="page categories-page">
    <div class="page-intro">
      <div>
        <span class="eyebrow">FIND A STORY THAT FEELS LIKE YOU</span>
        <h1>总有一部，正合你意<span class="accent-dot">。</span></h1>
        <p class="page-subtitle">从喜欢的类型出发，找到下一部好动画。</p>
      </div>
      <UBadge color="primary" variant="soft" size="lg">动漫分类</UBadge>
    </div>

    <UAlert v-if="!parsed.success" title="链接中的筛选条件无效，已展示全部分类。" color="warning" variant="soft" class="mb-5" />
    <GlassCard class="category-filters">
      <div class="flex flex-wrap items-center gap-2 border-b border-default pb-5 mb-1">
        <span class="text-xs text-muted mr-1">已选</span>
        <span v-if="!selected.length" class="text-sm text-muted">全部动画</span>
        <UButton v-for="item in selected" :key="item.key" size="xs" color="primary" variant="soft" trailing-icon="i-lucide-x" :aria-label="`移除${item.label}筛选`" @click="select(item.key, '全部')">{{ item.label }}</UButton>
        <UButton class="ml-auto" size="sm" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" to="/categories">重新筛选</UButton>
      </div>
      <div v-for="row in rows" :key="row.key" class="category-filter-row">
        <span aria-hidden="true" class="text-sm font-medium text-muted">{{ row.label }}</span>
        <USelect v-if="row.key === 'year'" :model-value="filters.year" :items="years" aria-label="年份筛选" class="sm:hidden w-full" @update:model-value="select('year', $event)" />
        <URadioGroup :model-value="filters[row.key]" :items="row.items" :legend="row.label" orientation="horizontal" variant="card" indicator="hidden" size="sm" :class="row.key === 'year' ? 'hidden sm:block' : undefined" :ui="radioUi" @update:model-value="select(row.key, $event)" />
      </div>
      <p class="text-xs text-muted mt-3">分类依据 Bangumi 标签，部分条目标注可能不完整。</p>
    </GlassCard>

    <div class="category-toolbar" aria-live="polite">
      <URadioGroup :model-value="filters.sort" :items="categorySorts" legend="排序方式" orientation="horizontal" variant="card" indicator="hidden" size="sm" :ui="radioUi" @update:model-value="select('sort', $event)" />
      <span class="text-xs text-muted">{{ status === 'pending' ? '正在筛选…' : data ? `找到 ${data.total} 部动画` : '探索你的下一部动画' }}</span>
    </div>

    <div v-if="status === 'pending'" class="subject-grid" aria-label="正在加载动漫" aria-busy="true">
      <USkeleton v-for="index in 12" :key="index" class="aspect-[3/5] rounded-3xl" />
    </div>
    <FeedbackState v-else-if="error" title="分类暂时无法加载" description="请稍后重试，或减少筛选条件。" retry @retry="refresh()" />
    <template v-else-if="data">
      <div v-if="data.data.length" class="subject-grid">
        <SubjectCard v-for="subject in data.data" :key="subject.id" :subject="subject" />
      </div>
      <FeedbackState v-else title="这个组合，还没找到故事" description="试试其他题材或年份，也可以移除部分筛选条件。" />
      <nav v-if="accessibleTotal > categoryPageSize" class="category-pagination" aria-label="动漫分类分页">
        <UPagination :page="filters.page" :total="accessibleTotal" :items-per-page="categoryPageSize" :sibling-count="1" :show-edges="false" :to="pageLink" color="neutral" variant="soft" />
      </nav>
      <p v-if="data.total >= categoryMaxResults" class="text-center text-xs text-muted mt-4">当前展示前 {{ categoryMaxResults }} 个结果，可选择题材和年份缩小范围。</p>
    </template>
  </div>
</template>

<style scoped>
.category-filters { padding: 24px; margin-bottom: 22px; }
.category-filter-row { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 14px; align-items: start; padding: 17px 0; border-bottom: 1px solid var(--line); }
.category-filter-row > span { padding-top: 7px; }
.category-filter-row:last-of-type { border-bottom: 0; }
.category-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 24px 0; flex-wrap: wrap; }
.category-pagination { display: flex; justify-content: center; margin: 32px 0 12px; }
@media (max-width: 600px) {
  .category-filters { padding: 17px; }
  .category-filter-row { grid-template-columns: 32px minmax(0, 1fr); gap: 8px; padding: 14px 0; }
  .category-toolbar { align-items: flex-start; }
}
</style>
