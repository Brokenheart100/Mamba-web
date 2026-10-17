<script setup lang="ts">
import { commentsPageSize, commentsMaxPages, subjectCommentsQuerySchema } from "#shared/schemas/comments";

const props = defineProps<{ subjectId: number }>();
const section = useTemplateRef<HTMLElement>("commentsSection");
const route = useRoute();
const parsed = computed(() => subjectCommentsQuerySchema.safeParse({ page: route.query.commentsPage }));
const page = computed(() => parsed.value.success ? parsed.value.data.page : 1);
const { data, status, error, refresh } = await useFetch(
  () => `/api/subjects/${props.subjectId}/comments`,
  { query: { page }, server: false, lazy: true, dedupe: "cancel" },
);
const bangumiUrl = computed(() => `https://bgm.tv/subject/${props.subjectId}/comments`);
const total = computed(() => Math.min(data.value?.total || 0, commentsMaxPages * commentsPageSize));
watch(status, async (value) => {
  if (value === "success" && route.hash === "#comments") {
    await nextTick();
    section.value?.scrollIntoView({ block: "start" });
  }
});
function pageLink(value: number) {
  return { path: route.path, query: { ...route.query, commentsPage: String(value) }, hash: "#comments" };
}
</script>

<template>
  <section id="comments" ref="commentsSection" class="section scroll-mt-24" aria-labelledby="comments-title">
    <div class="section-heading flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <h2 id="comments-title">大家怎么说</h2>
        <UBadge v-if="data && !error" color="neutral" variant="soft">{{ data.total }} 条短评</UBadge>
      </div>
      <UButton :to="bangumiUrl" external target="_blank" rel="noopener noreferrer" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-up-right">前往 Bangumi</UButton>
    </div>
    <p class="text-xs text-muted mb-5">来自 Bangumi 吐槽箱 · 短评可能包含剧透。参与讨论请前往 Bangumi。</p>
    <UAlert v-if="!parsed.success" color="warning" variant="soft" title="评论页码无效，已显示第 1 页。" class="mb-4" />
    <div v-if="status === 'idle' || status === 'pending'" class="space-y-4" aria-busy="true" aria-label="正在加载评论">
      <USkeleton v-for="index in 3" :key="index" class="h-32 rounded-3xl" />
    </div>
    <FeedbackState v-else-if="error" title="评论暂时无法加载" description="可以重试，或通过上方入口前往 Bangumi 查看。" retry @retry="refresh()" />
    <template v-else-if="data">
      <div v-if="data.data.length" class="space-y-4" aria-live="polite">
        <GlassCard v-for="comment in data.data" :key="comment.id" as="article" class="p-4 sm:p-5">
          <BangumiCommentBody :user="comment.user" :content="comment.content" :timestamp="comment.updatedAt" :rating="comment.rating" :status="comment.status" />
        </GlassCard>
      </div>
      <FeedbackState v-else :title="page > 1 ? '这一页暂时没有评论' : '还没有短评'" :description="page > 1 ? '试试返回前一页，或前往 Bangumi 查看。' : '这部动画的讨论，还在等待第一位观众。'" />
      <UButton v-if="page > 1 && !data.data.length" :to="pageLink(1)" color="neutral" variant="soft" class="mt-4">返回评论首页</UButton>
      <nav v-if="total > commentsPageSize" class="flex justify-center mt-6" aria-label="评论分页">
        <UPagination :page="page" :total="total" :items-per-page="commentsPageSize" :sibling-count="1" :show-edges="false" :to="pageLink" size="sm" color="neutral" variant="soft" />
      </nav>
      <p v-if="data.total > total" class="text-center text-xs text-muted mt-4">站内展示前 {{ total }} 条短评，更多内容可前往 Bangumi 查看。</p>
    </template>
  </section>
</template>
