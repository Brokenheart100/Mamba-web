<script setup lang="ts">
const model = defineModel<string | number>({ required: true });
defineProps<{
  items: { label: string; value: string | number }[];
  label?: string;
}>();
</script>
<template>
  <UTabs
    v-model="model"
    :items="items"
    :content="false"
    :aria-label="label || '切换分类'"
    color="neutral"
    variant="pill"
    class="ios-segments"
    :ui="{
      list: 'bg-transparent',
      trigger: 'whitespace-nowrap flex-none',
      indicator: 'bg-default shadow-sm',
    }"
  />
</template>
