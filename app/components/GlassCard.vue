<script setup lang="ts">
defineProps<{ interactive?: boolean }>();
function highlight(event: PointerEvent) {
  if (
    event.pointerType !== "mouse" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  const el = event.currentTarget as HTMLElement;
  const rect = el.getBoundingClientRect();
  el.style.setProperty(
    "--glass-x",
    `${((event.clientX - rect.left) / rect.width) * 100}%`,
  );
  el.style.setProperty(
    "--glass-y",
    `${((event.clientY - rect.top) / rect.height) * 100}%`,
  );
}
</script>
<template>
  <UCard
    variant="soft"
    class="glass-card"
    :class="{ 'glass-interactive': interactive }"
    :ui="{ body: 'glass-body p-0 sm:p-0', root: 'divide-none ring-0' }"
    @pointermove="highlight"
    ><slot
  /></UCard>
</template>
