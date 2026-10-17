<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    src?: string;
    alt: string;
    width?: number;
    height?: number;
    sizes?: string;
    loading?: "lazy" | "eager";
    fetchpriority?: "high" | "low" | "auto";
    fit?: "cover" | "contain";
  }>(),
  {
    src: undefined,
    width: 300,
    height: 428,
    sizes: "150px sm:220px",
    loading: "lazy",
    fetchpriority: "auto",
    fit: "cover",
  },
);
const failed = ref(false);
watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);
const source = computed(() => {
  if (failed.value || !props.src) return "/poster-placeholder.svg";
  try {
    const url = new URL(props.src);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : "/poster-placeholder.svg";
  } catch {
    return "/poster-placeholder.svg";
  }
});
// Only the metadata CDN is proxied through IPX. Imported covers stay direct.
const optimized = computed(() =>
  source.value.startsWith("https://lain.bgm.tv/"),
);
</script>
<template>
  <NuxtImg
    :src="source"
    :alt="alt"
    :provider="optimized ? 'ipx' : 'none'"
    :width="width"
    :height="height"
    :sizes="sizes"
    densities="x1 x2"
    format="webp"
    :quality="80"
    :fit="fit"
    :loading="loading"
    :fetchpriority="fetchpriority"
    decoding="async"
    referrerpolicy="no-referrer"
    @error="failed = true"
  />
</template>
