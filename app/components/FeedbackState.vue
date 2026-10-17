<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
  loading?: boolean;
  retry?: boolean;
}>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <div class="feedback-state" role="status">
    <span class="feedback-icon" :class="{ spinning: loading }"
      ><UIcon aria-hidden="true" :name="loading ? 'i-lucide-refresh-cw' : 'i-lucide-film'" :size="28" /></span>
    <h2>{{ title }}</h2>
    <p v-if="description">{{ description }}</p>
    <UButton
      v-if="retry"
      color="neutral"
      variant="soft"
      @click="$emit('retry')"
    >
      <UIcon aria-hidden="true" name="i-lucide-refresh-cw" :size="16" />重新加载
    </UButton>
  </div>
</template>
