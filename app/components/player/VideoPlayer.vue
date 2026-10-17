<script setup lang="ts">
import type Artplayer from "artplayer";
import type Hls from "hls.js";
import type {
  Option as DanmakuOptions,
  Result as DanmakuPlugin,
} from "artplayer-plugin-danmuku";
import type {
  Danmaku,
  PlaybackDescriptor,
  PlayerSettings,
} from "#shared/types/media";
import { normalizeSettings } from "#shared/utils/media";
import { danmakuMode, toPlayerDanmaku } from "../../player/danmaku-adapter";

const props = defineProps<{
  descriptor: PlaybackDescriptor;
  startTime: number;
  settings: PlayerSettings;
  danmaku?: Danmaku[];
  sourceId?: string;
}>();
const emit = defineEmits<{
  progress: [
    position: number,
    duration: number,
    completed: boolean,
    source: { sourceId: string; channel: string },
  ];
  fatal: [message: string];
  settings: [settings: PlayerSettings];
}>();
const host = ref<HTMLDivElement>();
const playbackSource = {
  sourceId: props.sourceId || "",
  channel: props.descriptor.channel,
};
const state = ref("loading");
const message = ref("");
const danmakuError = ref("");
let art: Artplayer | undefined;
let plugin: DanmakuPlugin | undefined;
let hls: Hls | undefined;
let media: HTMLVideoElement | undefined;
let disposed = false;
let started = false;
let resumed = false;
let preferencesReady = false;
let syncingDanmaku = false;
let reportedFailure = false;
let lastSaved = 0;
let lastDuration = 0;
let lastPosition = props.startTime;
let seekAttempts = 0;
let loadGeneration = 0;
let loadQueue: Promise<void> = Promise.resolve();
let startupTimer: ReturnType<typeof setTimeout> | undefined;

function flush(completed = false) {
  if (
    disposed ||
    !started ||
    !resumed ||
    !Number.isFinite(lastDuration) ||
    lastDuration <= 0
  )
    return;
  emit("progress", lastPosition, lastDuration, completed, playbackSource);
  lastSaved = Date.now();
}
function tick() {
  if (!media || disposed || !started || !resumed || media.seeking) return;
  lastPosition = media.currentTime;
  lastDuration = media.duration;
  if (Date.now() - lastSaved >= 5000) flush();
}
function resume() {
  if (!media || disposed || resumed) return;
  if (!props.startTime || props.startTime < 0.5) {
    resumed = true;
    return;
  }
  if (
    media.seekable.length &&
    props.startTime <= media.seekable.end(media.seekable.length - 1)
  ) {
    media.currentTime = Math.min(
      props.startTime,
      Number.isFinite(media.duration)
        ? Math.max(0, media.duration - 0.25)
        : props.startTime,
    );
    resumed = true;
  } else if (++seekAttempts > 15) {
    // Keep the old position until actual playback/seek establishes a new position.
    resumed = true;
    message.value = "此资源暂时无法恢复位置，可以手动拖动进度条。";
  }
}
function failed(text: string) {
  if (disposed || reportedFailure) return;
  reportedFailure = true;
  tick();
  flush();
  clearTimeout(startupTimer);
  state.value = "error";
  message.value = text;
  emit("fatal", text);
}
function preference() {
  if (!preferencesReady || disposed || !media) return;
  const validRate = [0.5, 0.75, 1, 1.25, 1.5, 2].includes(media.playbackRate);
  if (
    validRate &&
    (Math.abs(media.volume - props.settings.volume) > 0.001 ||
      media.playbackRate !== props.settings.rate)
  ) {
    emit("settings", {
      ...props.settings,
      volume: media.volume,
      rate: media.playbackRate,
    });
  }
}
function hidden(event: Event) {
  if (event.type === "pagehide" || document.visibilityState === "hidden") {
    tick();
    flush();
  }
}
function applyMediaSettings(value = props.settings) {
  if (!media) return;
  if (media.volume !== value.volume) media.volume = value.volume;
  media.defaultPlaybackRate = value.rate;
  if (media.playbackRate !== value.rate) media.playbackRate = value.rate;
}
function danmakuOptions(): DanmakuOptions {
  return {
    danmuku: [],
    visible: props.settings.danmaku,
    opacity: props.settings.danmakuOpacity,
    fontSize: props.settings.danmakuFontSize,
    speed: props.settings.danmakuSpeed,
    margin: [10, `${(1 - props.settings.danmakuArea) * 100}%`],
    modes: props.settings.danmakuModes.map((mode) => danmakuMode[mode]),
    antiOverlap: props.settings.danmakuAntiOverlap,
    synchronousPlayback: props.settings.danmakuSync,
    emitter: false,
    width: 0,
    FONT_SIZE: {
      min: 12,
      max: 36,
      steps: [
        { name: "小", value: 16 },
        { name: "标准", value: 24 },
        { name: "大", value: 32 },
      ],
    },
    SPEED: {
      min: 1,
      max: 10,
      steps: [
        { name: "慢", value: 10 },
        { name: "标准", value: 6 },
        { name: "快", value: 3 },
        { name: "极快", value: 1 },
      ],
    },
  };
}
function readDanmakuPreference() {
  if (!plugin || disposed || syncingDanmaku) return;
  const value = plugin.option;
  const settings = normalizeSettings({
    ...props.settings,
    danmaku: value.visible,
    danmakuOpacity: value.opacity,
    danmakuFontSize:
      typeof value.fontSize === "number"
        ? value.fontSize
        : props.settings.danmakuFontSize,
    danmakuSpeed: value.speed,
    danmakuArea: 1 - parseFloat(String(value.margin?.[1] || "0")) / 100,
    danmakuAntiOverlap: value.antiOverlap,
    danmakuSync: value.synchronousPlayback,
    danmakuModes: (["scroll", "top", "bottom"] as const).filter((mode) =>
      value.modes?.includes(danmakuMode[mode]),
    ),
  });
  if (JSON.stringify(settings) !== JSON.stringify(props.settings))
    emit("settings", settings);
}
function configureDanmaku() {
  if (!plugin || disposed) return;
  syncingDanmaku = true;
  try {
    // Preserve the loaded data: preference changes do not need to reload the pool.
    plugin.config({ ...danmakuOptions(), danmuku: plugin.option.danmuku });
  } finally {
    syncingDanmaku = false;
  }
}
function reloadDanmaku() {
  const generation = ++loadGeneration;
  const items = toPlayerDanmaku(
    props.danmaku || [],
    props.settings.danmakuOffset,
  );
  // The plugin loads asynchronously and mutates its input. Serialize replacements and drop stale jobs.
  loadQueue = loadQueue.then(async () => {
    if (!plugin || disposed || generation !== loadGeneration) return;
    syncingDanmaku = true;
    try {
      plugin.config({ ...danmakuOptions(), danmuku: items });
      await plugin.load();
      if (!disposed && generation === loadGeneration) danmakuError.value = "";
    } catch {
      if (!disposed) danmakuError.value = "弹幕未能加载，视频仍可正常播放。";
    } finally {
      syncingDanmaku = false;
    }
  });
}
async function attachHls(
  video: HTMLVideoElement,
  url: string,
  instance: Artplayer,
) {
  try {
    const { default: Hls } = await import("hls.js");
    if (disposed || instance.isDestroy) return;
    if (Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) failed("这条 HLS 线路暂时无法播放，请切换其他线路。");
      });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl"))
      video.src = url;
    else failed("当前浏览器不支持这类视频，请换一个浏览器或 MP4 线路。");
  } catch {
    failed("HLS 播放器初始化失败，请重新加载。");
  }
}
function makeControlsAccessible(instance: Artplayer) {
  const labels: Record<string, string> = {
    ".art-control-playAndPause": "播放或暂停",
    ".art-control-setting": "播放设置",
    ".art-control-pip": "画中画",
    ".art-control-fullscreenWeb": "网页全屏",
    ".art-control-fullscreen": "全屏",
    ".apd-toggle": "显示或隐藏弹幕",
    ".apd-config": "弹幕设置",
  };
  for (const [selector, label] of Object.entries(labels)) {
    const control =
      instance.template.$player.querySelector<HTMLElement>(selector);
    if (!control) continue;
    control.setAttribute("role", "button");
    control.setAttribute("aria-label", label);
    control.tabIndex = 0;
    instance.proxy(control, "keydown", (event) => {
      const key = (event as KeyboardEvent).key;
      if (key === "Enter" || key === " ") {
        event.preventDefault();
        event.stopPropagation();
        control.click();
      }
    });
  }
  const config =
    instance.template.$player.querySelector<HTMLElement>(".apd-config");
  if (config) {
    config.setAttribute("aria-expanded", "false");
    instance.proxy(config, "click", (event) => {
      if ((event.target as Element).closest(".apd-config-panel")) return;
      const open = config.dataset.open !== "true";
      config.dataset.open = String(open);
      config.setAttribute("aria-expanded", String(open));
    });
    instance.proxy(document, "click", (event) => {
      if (!config.contains(event.target as Node)) {
        config.dataset.open = "false";
        config.setAttribute("aria-expanded", "false");
      }
    });
    instance.proxy(config, "keydown", (event) => {
      if ((event as KeyboardEvent).key === "Escape") {
        config.dataset.open = "false";
        config.setAttribute("aria-expanded", "false");
        config.blur();
      }
    });
  }
  const sizePopups = () =>
    instance.template.$player.style.setProperty(
      "--ani-player-height",
      `${instance.template.$player.clientHeight}px`,
    );
  instance.on("resize", sizePopups);
  sizePopups();
}
watch(
  () => [props.settings.volume, props.settings.rate],
  () => applyMediaSettings(),
);
watch(
  () => [
    props.settings.danmaku,
    props.settings.danmakuOpacity,
    props.settings.danmakuFontSize,
    props.settings.danmakuSpeed,
    props.settings.danmakuArea,
    props.settings.danmakuAntiOverlap,
    props.settings.danmakuSync,
    ...props.settings.danmakuModes,
  ],
  configureDanmaku,
);
watch(() => [props.danmaku, props.settings.danmakuOffset], reloadDanmaku);

useEventListener(
  import.meta.client ? document : undefined,
  "visibilitychange",
  hidden,
);
useEventListener("pagehide", hidden);

onMounted(async () => {
  try {
    const [{ default: Artplayer }, { default: danmakuPlugin }] =
      await Promise.all([
        import("artplayer"),
        import("artplayer-plugin-danmuku"),
      ]);
    if (disposed || !host.value) return;
    Artplayer.LOG_VERSION = false;
    Artplayer.PLAYBACK_RATE = [0.5, 0.75, 1, 1.25, 1.5, 2];
    // Source fallback belongs to the watch page; avoid a competing retry loop.
    Artplayer.RECONNECT_TIME_MAX = 0;
    Artplayer.RECONNECT_SLEEP_TIME = 0;
    const createDanmaku = danmakuPlugin(danmakuOptions());
    art = new Artplayer({
      container: host.value,
      url: props.descriptor.url,
      type: props.descriptor.transport,
      customType: {
        hls: (video, url, instance) => attachHls(video, url, instance),
      },
      volume: props.settings.volume,
      lang: "zh-cn",
      theme: "#6ca8ff",
      autoplay: false,
      autoPlayback: false,
      setting: true,
      playbackRate: true,
      aspectRatio: true,
      fullscreen: true,
      fullscreenWeb: true,
      pip: true,
      playsInline: true,
      hotkey: true,
      lock: true,
      gesture: true,
      moreVideoAttr: { preload: "metadata" },
      cssVar: {
        "--art-control-height": "34px",
        "--art-control-icon-size": "28px",
        "--art-progress-height": "3px",
        "--art-padding": "12px",
        "--art-border-radius": "14px",
      },
      plugins: [
        (instance) => {
          plugin = createDanmaku(instance);
          return plugin;
        },
      ],
    });
    const instance = art;
    media = instance.video;
    media.setAttribute("aria-label", "视频播放器");
    instance.template.$player.classList.add("ani-artplayer");
    instance.template.$player.setAttribute("aria-label", "视频播放器控件");
    applyMediaSettings();
    // Keep fractional speeds exact; ArtPlayer's default labels round them to one decimal.
    for (const rate of Artplayer.PLAYBACK_RATE) {
      instance.setting.update({
        name: `playback-rate-${rate}`,
        html: rate === 1 ? "正常" : `${rate}×`,
      });
    }
    makeControlsAccessible(instance);
    instance.on("video:timeupdate", tick);
    instance.on("video:progress", resume);
    instance.on("video:loadedmetadata", () => {
      applyMediaSettings();
      preferencesReady = true;
      resume();
    });
    instance.on("video:canplay", () => {
      clearTimeout(startupTimer);
      resume();
      if (state.value === "loading") state.value = "ready";
    });
    instance.on("video:playing", () => {
      started = true;
      resume();
      state.value = "playing";
      message.value = "";
    });
    instance.on("video:pause", () => {
      if (state.value !== "error") state.value = "paused";
      tick();
      flush();
    });
    instance.on("video:seeking", () => plugin?.reset());
    instance.on("video:seeked", () => {
      resume();
      tick();
    });
    instance.on("video:ended", () => {
      tick();
      flush(true);
      state.value = "ended";
    });
    instance.on("video:waiting", () => {
      if (state.value !== "error") state.value = "buffering";
    });
    instance.on("video:volumechange", preference);
    instance.on("video:ratechange", preference);
    instance.on("video:error", () =>
      failed(
        media?.error?.code === 4
          ? "此线路的格式或访问条件不被浏览器支持，请换一条线路。"
          : "视频加载失败，请检查网络或切换线路。",
      ),
    );
    instance.on("artplayerPluginDanmuku:config", readDanmakuPreference);
    instance.on("artplayerPluginDanmuku:show", readDanmakuPreference);
    instance.on("artplayerPluginDanmuku:hide", readDanmakuPreference);
    instance.on("artplayerPluginDanmuku:error", () => {
      danmakuError.value = "弹幕未能加载，视频仍可正常播放。";
    });
    // Keep plugin async initialization and later imports in one queue.
    instance.on("artplayerPluginDanmuku:loaded", () => {
      if (!disposed) plugin?.reset();
    });
    reloadDanmaku();
    startupTimer = setTimeout(
      () => failed("视频加载超时，请检查网络或切换线路。"),
      25000,
    );
  } catch {
    failed("播放器初始化失败，请重新加载。");
  }
});
onBeforeUnmount(() => {
  tick();
  flush();
  disposed = true;
  ++loadGeneration;
  clearTimeout(startupTimer);
  hls?.destroy();
  art?.destroy();
  media?.pause();
  media?.removeAttribute("src");
  media?.load();
  art = undefined;
  plugin = undefined;
  media = undefined;
});
defineExpose({
  flush: () => {
    tick();
    flush();
  },
  position: () =>
    resumed ? (media?.currentTime ?? lastPosition) : props.startTime,
});
</script>
<template>
  <div class="video-player art-player-shell" :data-player-state="state">
    <div ref="host" class="art-player-host" />
    <div v-if="state === 'loading'" class="video-status" role="status">
      <UIcon aria-hidden="true" name="i-lucide-refresh-cw" class="spinning" :size="18" /><span
        >正在载入故事…</span
      >
    </div>
    <div
      v-if="danmakuError && state !== 'error'"
      class="danmaku-error"
      role="status"
    >
      {{ danmakuError }}
    </div>
    <div v-if="state === 'error'" class="video-failure" role="alert">
      <UIcon aria-hidden="true" name="i-lucide-film" :size="32" /><strong>这条线路暂时无法播放</strong>
      <p>{{ message }}</p>
    </div>
  </div>
</template>
