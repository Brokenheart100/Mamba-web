<script setup lang="ts">
import { commentsPageSize, subjectCommentsQuerySchema } from "#shared/schemas/comments";

const props = defineProps<{ episodeId: number; episodeTitle?: string }>();
const section = useTemplateRef<HTMLElement>("episodeCommentsSection");
const route = useRoute();
const parsed = computed(() => subjectCommentsQuerySchema.safeParse({ page: route.query.episodeCommentsPage }));
const page = computed(() => parsed.value.success ? parsed.value.data.page : 1);
const { data, status, error, refresh } = await useFetch(
  () => `/api/episodes/${props.episodeId}/comments`,
  { query: { page }, server: false, lazy: true, dedupe: "cancel" },
);
const bangumiUrl = computed(() => `https://bgm.tv/ep/${props.episodeId}`);
watch(status, async (value) => {
  if (value === "success" && route.hash === "#episode-comments") {
    await nextTick();
    section.value?.scrollIntoView({ block: "start" });
  }
});
function pageLink(value: number) {
  return { path: route.path, query: { ...route.query, episodeCommentsPage: String(value) }, hash: "#episode-comments" };
}
</script>

<template>
  <section id="episode-comments" ref="episodeCommentsSection" class="section scroll-mt-24" aria-labelledby="episode-comments-title">
    <div class="section-heading flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <h2 id="episode-comments-title">本集讨论</h2>
        <UBadge v-if="data && !error" color="neutral" variant="soft">{{ data.total }} 条评论</UBadge>
      </div>
      <UButton :to="bangumiUrl" external target="_blank" rel="noopener noreferrer" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-up-right">前往 Bangumi</UButton>
    </div>
    <p class="text-xs text-muted mb-5 [overflow-wrap:anywhere]">{{ episodeTitle || '当前章节' }} · 来自 Bangumi 章节讨论，可能包含本集剧透。参与讨论请前往原页。</p>
    <UAlert v-if="!parsed.success" color="warning" variant="soft" title="评论页码无效，已显示第 1 页。" class="mb-4" />
    <div v-if="status === 'idle' || status === 'pending'" class="space-y-4" aria-busy="true" aria-label="正在加载本集讨论">
      <USkeleton v-for="index in 3" :key="index" class="h-32 rounded-3xl" />
    </div>
    <FeedbackState v-else-if="error" title="本集讨论暂时无法加载" description="可以重试，或通过上方入口前往 Bangumi 查看。" retry @retry="refresh()" />
    <template v-else-if="data">
      <div v-if="data.data.length" class="space-y-4" aria-live="polite">
        <GlassCard v-for="comment in data.data" :key="comment.id" as="article" class="p-4 sm:p-5">
          <BangumiCommentBody :user="comment.user" :content="comment.content" :timestamp="comment.createdAt" />
          <UCollapsible v-if="comment.replies.length" class="mt-3" :ui="{ content: 'space-y-4 pt-4' }">
            <template #default="{ open }">
              <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-messages-square" :trailing-icon="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'">{{ open ? '收起' : '展开' }} {{ comment.replies.length }} 条回复</UButton>
            </template>
            <template #content>
              <article v-for="reply in comment.replies" :key="reply.id" class="border-l border-default pl-3 sm:ml-10 sm:pl-4">
                <BangumiCommentBody :user="reply.user" :content="reply.content" :timestamp="reply.createdAt" />
              </article>
            </template>
          </UCollapsible>
        </GlassCard>
      </div>
      <FeedbackState v-else :title="page > 1 ? '这一页暂时没有评论' : '本集还没有讨论'" description="可以前往 Bangumi 查看或参与讨论。" />
      <UButton v-if="page > 1 && !data.data.length" :to="pageLink(1)" color="neutral" variant="soft" class="mt-4">返回评论首页</UButton>
      <nav v-if="data.total > commentsPageSize" class="flex justify-center mt-6" aria-label="本集讨论分页">
        <UPagination :page="page" :total="data.total" :items-per-page="commentsPageSize" :sibling-count="1" :show-edges="false" :to="pageLink" size="sm" color="neutral" variant="soft" />
      </nav>
    </template>
  </section>
</template>
