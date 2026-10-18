<script setup lang="ts">
const { data, status, error, refresh } = await useFetch("/api/calendar");
const weekday = ref(0);
onMounted(() => {
  weekday.value = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai",
      weekday: "short",
    })
      .format(new Date())
      .replace("Sun", "7")
      .replace("Mon", "1")
      .replace("Tue", "2")
      .replace("Wed", "3")
      .replace("Thu", "4")
      .replace("Fri", "5")
      .replace("Sat", "6"),
  );
});
const all = computed(() => (data.value || []).flatMap((d) => d.subjects));
const featured = computed(() => {
  const recent = all.value.filter(
    (subject) =>
      subject.date.slice(0, 4) >= String(new Date().getUTCFullYear()) &&
      subject.ratingCount >= 50,
  );
  return [...(recent.length ? recent : all.value)].sort(
    (a, b) => b.score - a.score || b.ratingCount - a.ratingCount,
  )[0];
});
const selectedDay = ref(0);
const selected = computed(() =>
  selectedDay.value
    ? data.value?.find((d) => d.id === selectedDay.value)?.subjects || []
    : [...all.value].sort((a, b) => b.score - a.score).slice(0, 18),
);
useSeoMeta({ title: "发现好动画 — Mamba-Animation" });
</script>
<template>
  <div class="page discover-page">
    <div class="page-intro">
      <div>
        <span class="eyebrow">YOUR DAILY DOSE OF ANIME</span>
        <h1>今天，也有好故事<span class="accent-dot">。</span></h1>
      </div>
      <span class="intro-note"><i /> 打开即看，自在追番</span>
    </div>
    <FeedbackState v-if="error" title="故事正在路上" description="暂时无法获取番剧资料，请检查网络后重试。" retry @retry="refresh()" />
    <FeedbackState v-else-if="status === 'pending' && !featured" title="正在寻找好故事…" loading />
    <section v-if="featured" class="hero">
      <AnimeCover
class="hero-art" :width="1280" :height="720" sizes="100vw lg:900px" loading="eager"
        :src="featured.image" :alt="featured.name" referrerpolicy="no-referrer" fetchpriority="high" />
      <div class="hero-shade" />
      <div class="hero-content">
        <span class="hero-kicker"><span>本季发现</span> SEASON SPOTLIGHT</span>
        <div class="hero-tags">
          <span>{{ featured.platform }}</span><span>{{ featured.date.slice(0, 4) }}</span><span
v-if="featured.score"
            class="hero-rating">★ {{ featured.score.toFixed(1) }} <small>Bangumi</small></span>
        </div>
        <h2>{{ featured.name }}</h2>
        <p class="hero-original">{{ featured.originalName }}</p>
        <p class="hero-description">
          {{
            featured.summary ||
            "每周更新的故事，在这里与你相遇。打开番剧详情，发现角色、章节与更多精彩。"
          }}
        </p>
        <UButton
:to="`/subject/${featured.id}`" class="hero-cta" size="xl" icon="i-lucide-play"
          trailing-icon="i-lucide-arrow-right">探索这部番剧</UButton>
        <div class="hero-footnote">
          <span class="tiny-line" /> 一段新的旅程，从这里开始。
        </div>
      </div>
      <span class="hero-number">01<span> / DISCOVER</span></span>
    </section>
    <ContinueWatching />
    <section v-if="data?.length" class="section">
      <div class="section-heading">
        <div>
          <span class="eyebrow">THIS SEASON, YOUR NEXT FAVORITE</span>
          <h2>新番放映中<span class="season-pill">ON AIR</span></h2>
        </div>
        <NuxtLink to="/schedule" class="text-link">完整时间表
          <UIcon aria-hidden="true" name="i-lucide-arrow-right" :size="16" />
        </NuxtLink>
      </div>
      <SegmentedControl
v-model="selectedDay" :items="[
        { label: '全部精选', value: 0 },
        ...data.map((day) => ({
          label: day.name + (day.id === weekday ? ' ·' : ''),
          value: day.id,
        })),
      ]" label="按星期筛选" />
      <div class="subject-grid">
        <SubjectCard v-for="subject in selected" :key="subject.id" :subject="subject" />
      </div>
      <FeedbackState v-if="!selected.length" title="今天暂时没有排片" description="换个日期，看看其他好故事。" />
    </section>
    <GlassCard class="bottom-banner">
      <div class="banner-symbol">✦</div>
      <div>
        <strong>把时间留给喜欢的故事。</strong>
        <p>不用注册，不用记住进度。下一次，从心动的地方继续。</p>
      </div>
      <NuxtLink to="/history" class="text-link">我的观看记录
        <UIcon aria-hidden="true" name="i-lucide-arrow-up-right" :size="18" />
      </NuxtLink>
    </GlassCard>
  </div>
</template>
