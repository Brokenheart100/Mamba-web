<script setup lang="ts">
import type { Danmaku, PlaybackDescriptor } from "#shared/types/media";
import { defaultSettings, formatTime } from "#shared/utils/media";
const settings = ref({ ...defaultSettings });
const demoDanmaku: Danmaku[] = [
  {
    id: "demo-0",
    time: 0.5,
    text: "欢迎来到你的放映室 ✦",
    color: "#ffffff",
    mode: "scroll",
  },
  {
    id: "demo-1",
    time: 7,
    text: "这是本地演示弹幕",
    color: "#a9ceff",
    mode: "top",
  },
  {
    id: "demo-2",
    time: 3,
    text: "暂停、拖动、倍速，弹幕与画面一起走",
    color: "#ffffff",
    mode: "bottom",
  },
  {
    id: "demo-3",
    time: 15,
    text: "用控制栏的弹幕设置调整字号和显示区域",
    color: "#d7c0ff",
    mode: "scroll",
  },
];
const kind = ref<"mp4" | "hls">("mp4");
const sources: Record<"mp4" | "hls", PlaybackDescriptor> = {
  mp4: {
    url: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    transport: "mp4",
    sourceName: "W3C 公开测试素材",
    channel: "Sintel 预告片",
  },
  hls: {
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    transport: "hls",
    sourceName: "hls.js / Mux 公开测试流",
    channel: "Big Buck Bunny",
  },
};
const error = ref("");
const position = ref(0);
const startTime = ref(0);
const generation = ref(0);
function progress(value: number) {
  position.value = value;
}
function resume() {
  startTime.value = position.value;
  generation.value++;
}
watch(kind, () => {
  error.value = "";
  position.value = 0;
  startTime.value = 0;
});
useSeoMeta({ title: "播放器体验 — Mamba-Animation" });
</script>
<template>
  <div class="page lab-page">
    <div class="page-intro">
      <div>
        <span class="eyebrow">A SMALL SCREEN TEST</span>
        <h1>先试一场放映<span class="accent-dot">。</span></h1>
        <p class="page-subtitle">
          这里是公开测试视频，不是番剧正片，不会写入观看记录。
        </p>
      </div>
      <span class="small-pill">PLAYER LAB</span>
    </div>
    <SegmentedControl
      v-model="kind"
      :items="[
        { label: 'MP4 · Sintel 预告片', value: 'mp4' },
        { label: 'HLS · Big Buck Bunny', value: 'hls' },
      ]"
      label="视频格式"
    />
    <PlayerVideoPlayer
      :key="`${kind}-${generation}`"
      :descriptor="sources[kind]"
      :start-time="startTime"
      :settings="settings"
      :danmaku="demoDanmaku"
      @progress="progress"
      @fatal="error = $event"
      @settings="settings = $event"
    />
    <p v-if="error" class="notice warning" role="alert">{{ error }}</p>
    <div class="lab-info panel">
      <div>
        <h2>{{ sources[kind].channel }}</h2>
        <p>{{ sources[kind].sourceName }}</p>
      </div>
      <UButton color="neutral" variant="soft" @click="resume">
        <UIcon aria-hidden="true" name="i-lucide-refresh-cw" :size="16" />从
        {{ formatTime(position) }} 重载续播
      </UButton>
    </div>
    <p class="muted">
      测试视频可能受网络影响。演示弹幕是本地示例，可在控制栏调整显示、字号、速度、区域和防重叠，不会发送到服务器。
    </p>
  </div>
</template>
