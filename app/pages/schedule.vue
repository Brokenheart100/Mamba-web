<script setup lang="ts">
const { data, error, refresh } = await useFetch("/api/calendar");
const selected = ref(1);
const subjects = computed(
  () => data.value?.find((day) => day.id === selected.value)?.subjects || [],
);
useSeoMeta({ title: "新番时间表 — Mamba-Animation" });
</script>
<template>
  <div class="page">
    <div class="page-intro">
      <div>
        <span class="eyebrow">A LITTLE SOMETHING TO LOOK FORWARD TO</span>
        <h1>一周，都有期待<span class="accent-dot">。</span></h1>
        <p class="page-subtitle">
          新番放送时间来自 Bangumi，实际上线以视频源为准。
        </p>
      </div>
      <UIcon aria-hidden="true" name="i-lucide-calendar-days" :size="34" />
    </div>
    <FeedbackState v-if="error" title="时间表暂时无法加载" retry @retry="refresh()" /><template v-else>
      <SegmentedControl
v-model="selected" :items="(data || []).map((day) => ({
        label: day.name + ' · ' + day.subjects.length,
        value: day.id,
      }))
        " label="选择星期" class="schedule-tabs" />
      <div class="subject-grid">
        <SubjectCard v-for="subject in subjects" :key="subject.id" :subject="subject" />
      </div>
      <FeedbackState v-if="data && !subjects.length" title="这一天暂时没有排片" />
    </template>
  </div>
</template>
