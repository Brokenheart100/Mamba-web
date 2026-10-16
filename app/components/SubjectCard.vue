<script setup lang="ts">
import type { Subject } from "#shared/types/media";
defineProps<{ subject: Subject; index?: number }>();
</script>
<template>
  <NuxtLink :to="`/subject/${subject.id}`" class="subject-card">
    <GlassCard interactive class="poster-glass">
      <div class="poster">
        <AnimeCover
          v-if="subject.image"
          :src="subject.image"
          :alt="subject.name"
          loading="lazy"
          referrerpolicy="no-referrer"
        />
        <div v-else class="poster-placeholder">
          <AppIcon name="Film" :size="36" />
        </div>
        <span v-if="subject.score" class="score-badge"
          ><span>★</span> {{ subject.score.toFixed(1) }}</span
        ><span class="poster-play"><AppIcon name="Play" :size="22" /></span
        ><span class="poster-type">{{ subject.platform || "TV" }}</span>
      </div>
      <h3>{{ subject.name }}</h3>
      <p>
        {{ subject.date ? subject.date.slice(0, 4) : "日期待定" }}<span>·</span
        >{{
          subject.episodes
            ? `${subject.episodes} 话`
            : subject.originalName === subject.name
              ? "查看详情"
              : subject.originalName
        }}
      </p>
    </GlassCard>
  </NuxtLink>
</template>
