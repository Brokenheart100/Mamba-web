<script setup lang="ts">
import type { Subject } from "#shared/types/media";
defineProps<{ subject: Subject; index?: number; to?: string; external?: boolean; subtitle?: string }>();
</script>
<template>
  <NuxtLink :to="to || `/subject/${subject.id}`" :external="external" :target="external ? '_blank' : undefined" :rel="external ? 'noopener noreferrer' : undefined" class="subject-card">
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
          <UIcon aria-hidden="true" name="i-lucide-film" :size="36" />
        </div>
        <span v-if="subject.score" class="score-badge"
          ><span>★</span> {{ subject.score.toFixed(1) }}</span
        ><span class="poster-play"><UIcon aria-hidden="true" name="i-lucide-play" :size="22" /></span
        ><span class="poster-type">{{ subject.platform || "TV" }}</span>
      </div>
      <h3>{{ subject.name }}</h3>
      <p v-if="subtitle">{{ subtitle }}</p>
      <p v-else>
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
