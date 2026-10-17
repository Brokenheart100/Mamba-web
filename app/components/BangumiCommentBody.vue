<script setup lang="ts">
import type { SubjectComment } from "#shared/schemas/comments";
const props = defineProps<{
  user: SubjectComment["user"];
  content: string;
  timestamp: number;
  rating?: number;
  status?: string;
}>();
const formatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
});
const date = computed(() => props.timestamp ? new Date(props.timestamp * 1000) : undefined);
</script>
<template>
  <div class="flex gap-3 min-w-0">
    <NuxtLink v-if="user.url" :to="user.url" external target="_blank" rel="noopener noreferrer" :aria-label="`${user.name} 的 Bangumi 主页`" class="shrink-0">
      <UAvatar :src="user.avatar || undefined" :alt="user.name" size="md" loading="lazy" referrerpolicy="no-referrer" />
    </NuxtLink>
    <UAvatar v-else :alt="user.name" size="md" class="shrink-0" />
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <NuxtLink v-if="user.url" :to="user.url" external target="_blank" rel="noopener noreferrer" class="font-semibold text-sm break-all hover:text-primary">{{ user.name }}</NuxtLink>
        <span v-else class="font-semibold text-sm">{{ user.name }}</span>
        <UBadge v-if="status" color="neutral" variant="soft" size="xs">{{ status }}</UBadge>
        <UBadge v-if="rating" color="primary" variant="soft" size="xs" icon="i-lucide-star">{{ rating }} / 10</UBadge>
        <time :datetime="date?.toISOString()" class="text-xs text-muted sm:ml-auto">{{ date ? formatter.format(date) : '日期未知' }}</time>
      </div>
      <p class="text-sm leading-7 whitespace-pre-wrap [overflow-wrap:anywhere] mt-3">{{ content }}</p>
    </div>
  </div>
</template>
