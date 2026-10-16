<script setup lang="ts">
import { formatTime } from "#shared/utils/media";
const { recentSubjects, refresh } = useLocalLibrary();
onMounted(refresh);
</script>
<template>
  <section v-if="recentSubjects.length" class="section continue-section">
    <div class="section-heading">
      <div>
        <span class="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
        <h2>
          继续你的故事<span class="count-label">{{
            recentSubjects.length
          }}</span>
        </h2>
      </div>
      <NuxtLink to="/history" class="text-link"
        >全部记录 <AppIcon name="ArrowRight" :size="16"
      /></NuxtLink>
    </div>
    <div class="continue-grid">
      <NuxtLink
        v-for="row in recentSubjects.slice(0, 3)"
        :key="row.key"
        :to="`/watch/${row.subjectId}/${row.episodeId}`"
        class="continue-link"
        ><GlassCard interactive class="continue-card"
          ><AnimeCover
            :src="row.image"
            :width="72"
            :height="102"
            sizes="72px"
            :alt="row.subjectName"
            referrerpolicy="no-referrer" />
          <div class="continue-content">
            <h3>{{ row.subjectName }}</h3>
            <p>
              第 {{ row.sort }} 话<span>·</span
              >{{ row.completed ? "已看完" : formatTime(row.position) }}
            </p>
            <div class="mini-progress">
              <i
                :style="{
                  width: `${Math.min(100, row.duration ? (row.position / row.duration) * 100 : 0)}%`,
                }"
              />
            </div>
          </div>
          <span class="continue-play"
            ><AppIcon name="Play" :size="18" /></span></GlassCard
      ></NuxtLink>
    </div>
  </section>
</template>
