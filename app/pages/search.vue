<script setup lang="ts">
const route = useRoute();
const query = computed(() => String(route.query.q || "").trim());
const keyword = ref(query.value);
const offset = computed(() => Math.max(0, Number(route.query.offset) || 0));
const { data, status, error, refresh } = await useFetch(
  "/api/subjects/search",
  { query: { q: query, offset }, immediate: !!query.value },
);
watch(query, (value) => {
  keyword.value = value;
  // An initially empty search uses immediate:false; execute its first query explicitly.
  if (value && status.value === "idle") void refresh();
});
function search() {
  if (keyword.value.trim())
    void navigateTo({ path: "/search", query: { q: keyword.value.trim() } });
}
useSeoMeta({ title: () => `${query.value || "搜索番剧"} — Mamba-Animation` });
</script>
<template>
  <div class="page">
    <div class="page-intro">
      <div>
        <span class="eyebrow">FIND YOUR NEXT OBSESSION</span>
        <h1>寻找你的下一部<span class="accent-dot">。</span></h1>
      </div>
    </div>
    <form class="search-form" @submit.prevent="search">
      <UInput
        v-model="keyword"
        icon="i-lucide-search"
        aria-label="番剧搜索关键词"
        placeholder="输入中文名、原名或关键词"
        :maxlength="100"
        variant="none"
        size="xl"
      /><UButton type="submit" size="lg">搜索</UButton>
    </form>
    <div v-if="query" class="results-heading">
      <h2>“{{ query }}” 的搜索结果</h2>
      <span v-if="data">共 {{ data.total }} 部</span>
    </div>
    <FeedbackState
      v-if="status === 'pending'"
      title="正在寻找…"
      loading
    /><FeedbackState
      v-else-if="error"
      title="搜索暂时失败"
      description="请检查网络，或尝试另一个关键词。"
      retry
      @retry="refresh()"
    /><template v-else-if="data && query"
      ><div class="subject-grid">
        <SubjectCard
          v-for="subject in data.data"
          :key="subject.id"
          :subject="subject"
        />
      </div>
      <FeedbackState
        v-if="!data.data.length"
        title="还没找到这个故事"
        description="试试更短的名称，或使用日文原名。" />
      <nav
        v-if="data.total > data.limit"
        class="pagination"
        aria-label="搜索分页"
      >
        <UButton
          v-if="offset"
          :to="{
            query: { q: query, offset: Math.max(0, offset - data.limit) },
          }"
          color="neutral"
          variant="soft"
          ><UIcon aria-hidden="true" name="i-lucide-chevron-left" :size="16" />上一页</UButton
        ><span>第 {{ Math.floor(offset / data.limit) + 1 }} 页</span
        ><UButton
          v-if="offset + data.limit < Math.min(1000, data.total)"
          :to="{ query: { q: query, offset: offset + data.limit } }"
          color="neutral"
          variant="soft"
          >下一页<UIcon aria-hidden="true" name="i-lucide-chevron-right" :size="16" /></UButton></nav></template
    ><FeedbackState
      v-else
      title="好故事，从一个名字开始"
      description="输入番剧名称，发现你想看的动画。"
    />
  </div>
</template>
