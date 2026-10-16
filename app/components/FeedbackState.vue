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
      ><AppIcon :name="loading ? 'RefreshCw' : 'Film'" :size="28"
    /></span>
    <h2>{{ title }}</h2>
    <p v-if="description">{{ description }}</p>
    <UButton
      color="neutral"
      variant="soft"
      v-if="retry"
      @click="$emit('retry')"
    >
      <AppIcon name="RefreshCw" :size="16" />重新加载
    </UButton>
  </div>
</template>
