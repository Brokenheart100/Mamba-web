<script setup lang="ts">
import SubjectCard from "./SubjectCard.vue";
import AnimeCover from "./AnimeCover.vue";
import UCarousel from "@nuxt/ui/components/Carousel.vue";
const props = defineProps<{ subjectId: number }>();
const relationTab = ref("anime");
const bangumiLink = (kind: "subject" | "character" | "person", id: number) => `https://bgm.tv/${kind}/${id}`;
const { data: relations, status: relationsStatus, error: relationsError, refresh: refreshRelations } = await useFetch(
  () => `/api/subjects/${props.subjectId}/related`, { server: false, lazy: true },
);
const { data: characters, status: charactersStatus, error: charactersError, refresh: refreshCharacters } = await useFetch(
  () => `/api/subjects/${props.subjectId}/characters`, { server: false, lazy: true },
);
const anime = computed(() => (relations.value || []).filter((row) => row.type === 2));
const visible = computed(() => relationTab.value === "anime" ? anime.value : relations.value || []);
</script>
<template>
  <div class="subject-extras">
  <section class="section" aria-labelledby="related-title">
    <div class="section-heading">
      <h2 id="related-title">故事，还在继续</h2>
      <span class="muted">关联作品</span>
    </div>
    <USkeleton v-if="relationsStatus === 'pending' || relationsStatus === 'idle'" class="h-48 rounded-3xl" />
    <FeedbackState v-else-if="relationsError" title="关联作品暂时无法加载" retry @retry="refreshRelations()" />
    <div v-else>
      <UTabs v-model="relationTab" :items="[{ label: `相关动画 · ${anime.length}`, value: 'anime' }, { label: `全部关联 · ${relations?.length || 0}`, value: 'all' }]" :content="false" class="mb-6 max-w-md" aria-label="关联作品类型" />
      <div v-if="visible.length" class="subject-grid">
        <div v-for="row in visible" :key="row.subject.id" class="min-w-0">
          <SubjectCard :subject="row.subject" :subtitle="row.relation" :external="row.type !== 2" :to="row.type === 2 ? undefined : bangumiLink('subject', row.subject.id)" />
        </div>
      </div>
      <p v-else class="text-sm text-muted py-5">暂时没有这类关联作品。</p>
      <p class="text-xs text-muted mt-4">漫画、音乐等资料会在 Bangumi 打开。</p>
    </div>
  </section>
  <section class="section" aria-labelledby="characters-title">
    <div class="section-heading">
      <h2 id="characters-title">让故事鲜活的人</h2>
      <span class="muted">角色与声优 · {{ characters?.length || 0 }}</span>
    </div>
    <USkeleton v-if="charactersStatus === 'pending' || charactersStatus === 'idle'" class="h-64 rounded-3xl" />
    <FeedbackState v-else-if="charactersError" title="角色资料暂时无法加载" retry @retry="refreshCharacters()" />
    <UCarousel v-else-if="characters?.length" :items="characters" arrows :ui="{ item: 'basis-1/2 sm:basis-1/3 lg:basis-1/5', prev: 'start-0 sm:start-0 top-20', next: 'end-0 sm:end-0 top-20' }" class="px-5" aria-label="角色与声优">
      <template #default="{ item }">
      <GlassCard class="p-3 h-full">
        <NuxtLink :to="bangumiLink('character', item.id)" external target="_blank" rel="noopener noreferrer">
          <AnimeCover :src="item.image" :alt="item.name" :width="160" :height="200" sizes="160px" fit="contain" class="w-full aspect-[4/5] object-contain rounded-2xl" referrerpolicy="no-referrer" />
          <h3 class="text-sm font-semibold truncate mt-3">{{ item.name }}</h3>
        </NuxtLink>
        <UBadge color="neutral" variant="soft" size="xs" class="my-2">{{ item.relation }}</UBadge>
        <div class="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted">
          <NuxtLink v-for="actor in item.actors" :key="actor.id" :to="bangumiLink('person', actor.id)" external target="_blank" rel="noopener noreferrer" class="hover:text-primary">{{ actor.name }}</NuxtLink>
          <span v-if="!item.actors.length">声优资料待补充</span>
        </div>
      </GlassCard>
      </template>
    </UCarousel>
    <p v-else class="text-sm text-muted py-5">角色与声优资料尚未收录。</p>
  </section>
  </div>
</template>
