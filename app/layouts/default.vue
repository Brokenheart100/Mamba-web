<script setup lang="ts">
const route = useRoute();
const search = ref("");
const menuOpen = ref(false);
const sidebarHidden = useLocalStorage("ani.sidebar-hidden", false, {
  initOnMounted: true,
  writeDefaults: false,
  onError: () => {
    /* Keep the in-memory preference when storage is unavailable. */
  },
});
const compact = useMediaQuery("(max-width: 900px)", { ssrWidth: 1440 });
const colorMode = useColorMode();
const navigation = computed(() => [
  {
    to: "/",
    label: "发现",
    icon: "i-lucide-compass",
    active: route.path === "/",
  },
  {
    to: "/categories",
    label: "动漫分类",
    icon: "i-lucide-layout-grid",
    active: route.path === "/categories",
  },
  {
    to: "/schedule",
    label: "新番时间表",
    icon: "i-lucide-calendar-days",
    active: route.path === "/schedule",
  },
  { to: "/seasons", label: "季度新番", icon: "i-lucide-sparkles", active: route.path === "/seasons" },
  { to: "/rankings", label: "动画榜单", icon: "i-lucide-trophy", active: route.path === "/rankings" },
  {
    to: "/history",
    label: "观看记录",
    icon: "i-lucide-clock-3",
    active: route.path === "/history",
  },
]);
const tools = computed(() => [
  {
    to: "/sources",
    label: "播放源",
    icon: "i-lucide-radio",
    active: route.path === "/sources",
  },
  {
    to: "/player-lab",
    label: "播放器体验",
    icon: "i-lucide-monitor-play",
    active: route.path === "/player-lab",
  },
]);
watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false;
  },
);
watch(compact, () => {
  menuOpen.value = false;
});
useEventListener("keydown", (event) => {
  if (event.key === "Escape") menuOpen.value = false;
});
function toggleSidebar() {
  if (compact.value) menuOpen.value = !menuOpen.value;
  else sidebarHidden.value = !sidebarHidden.value;
}
function submit() {
  if (search.value.trim())
    void navigateTo({ path: "/search", query: { q: search.value.trim() } });
}
</script>
<template>
  <div class="app-shell" :class="{ 'sidebar-hidden': sidebarHidden }">
    <a href="#main-content" class="skip-link">跳到主要内容</a>
    <button v-if="menuOpen" class="sidebar-scrim" aria-label="关闭导航" @click="menuOpen = false" />
    <aside class="sidebar liquid-surface" :class="{ open: menuOpen }" aria-label="侧栏导航">
      <NuxtLink to="/" class="brand" aria-label="Mamba-Animation 首页"><span class="brand-mark">
          <UIcon name="i-lucide-play" />
        </span><span class="brand-name"><span>Mamba-</span><span>Animation</span></span>
        <UBadge color="neutral" variant="soft" size="xs">WEB</UBadge>
      </NuxtLink>
      <div class="nav-label">你的放映室</div>
      <UNavigationMenu
:items="navigation" orientation="vertical" color="primary" class="primary-nav"
        aria-label="主导航" />
      <div class="sidebar-divider" />
      <div class="nav-label">随心观看</div>
      <UNavigationMenu :items="tools" orientation="vertical" color="primary" aria-label="观看工具" />
      <div class="sidebar-bottom">
        <GlassCard class="privacy-card"><span class="privacy-icon">
            <UIcon name="i-lucide-shield-check" />
          </span><strong>只属于你的进度</strong>
          <p>无需登录，观看记录<br>安静地留在这台设备。</p>
          <span class="privacy-status"><i /> LOCAL FIRST</span>
        </GlassCard>
        <UButton
to="/settings" color="neutral" variant="ghost" icon="i-lucide-settings-2" block class="settings-nav"
          :class="{ active: route.path === '/settings' }">偏好设置</UButton>
        <p class="sidebar-credit">
          为每一次心动，留一席光。<span>Made for anime lovers.</span>
        </p>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <UButton
color="neutral" variant="ghost" icon="i-lucide-panel-left"
          :aria-label="sidebarHidden ? '显示侧栏' : '切换侧栏'" class="sidebar-toggle" @click="toggleSidebar" />
        <div class="topbar-caption">
          好故事，值得慢慢看。<span>STORIES WORTH YOUR TIME</span>
        </div>
        <form class="global-search" role="search" @submit.prevent="submit">
          <UInput
v-model="search" icon="i-lucide-search" aria-label="搜索番剧" placeholder="搜索你想看的番剧" :maxlength="100"
            color="neutral" variant="soft" class="w-full" :ui="{ base: 'rounded-full bg-transparent ring-0' }"><template
              #trailing>
              <UKbd>↵</UKbd>
            </template></UInput>
        </form>
        <ClientOnly>
          <UButton
color="neutral" variant="ghost" :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'
            " aria-label="切换明暗外观" @click="
              colorMode.preference =
              colorMode.value === 'dark' ? 'light' : 'dark'
              " />
        </ClientOnly>
        <span class="local-badge"><i /> 本地模式</span>
      </header>
      <main id="main-content">
        <slot />
      </main>
      <footer class="footer">
        <span><span class="footer-brand">Mamba-Animation</span>
          让追番回到简单。</span><span>番剧资料来自
          <a href="https://bgm.tv" target="_blank" rel="noopener noreferrer">Bangumi
            <UIcon name="i-lucide-arrow-up-right" />
          </a><span class="footer-dot">·</span>观看记录仅保存在本地</span>
      </footer>
    </div>
  </div>
</template>
