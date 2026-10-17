<script setup lang="ts">
import { defaultSettings } from "#shared/utils/media";
import * as library from "../repositories/local-library";
const { records, refresh, storageError } = useLocalLibrary();
const settings = ref({ ...defaultSettings });
const message = ref("");
const confirmClear = ref(false);
onMounted(async () => {
  await refresh();
  try {
    settings.value = await library.getSettings();
  } catch {
    message.value = "偏好设置无法读取。";
  }
});
useSeoMeta({ title: "偏好设置 — Mamba-Animation" });
async function save() {
  try {
    await library.saveSettings({ ...settings.value });
    message.value = "偏好已保存到本地。";
  } catch {
    message.value = "保存失败，请检查浏览器存储权限。";
  }
}
async function download() {
  try {
    const text = await library.exportProgress();
    const url = URL.createObjectURL(
      new Blob([text], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `mamba-animation-history-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message.value = "观看记录已导出。视频地址与弹幕文件不包含在导出中。";
  } catch {
    message.value = "导出失败，请稍后重试。";
  }
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 5_000_000) throw new Error("请选择 5 MB 以内的文件。");
    const count = await library.importProgress(await file.text());
    await refresh();
    message.value = `已读取 ${count} 条记录，新记录已合并。`;
  } catch (error) {
    message.value =
      error instanceof Error ? error.message : "导入失败，原有记录未修改。";
  }
  input.value = "";
}
async function clear() {
  try {
    await library.clearProgress();
    await refresh();
    confirmClear.value = false;
    message.value = "观看记录已清空。";
  } catch {
    message.value = "清空失败，请稍后重试。";
  }
}
</script>
<template>
  <div class="page settings-page">
    <div class="page-intro">
      <div>
        <span class="eyebrow">MAKE YOURSELF AT HOME</span>
        <h1>按你的方式观看<span class="accent-dot">。</span></h1>
        <p class="page-subtitle">所有偏好都留在这台设备，无需账户。</p>
      </div>
    </div>
    <UAlert
      v-if="message"
      class="mb-5"
      color="primary"
      variant="soft"
      :description="message"
    />
    <UAlert
      v-if="storageError"
      class="mb-5"
      color="warning"
      variant="soft"
      :description="storageError"
    />
    <GlassCard class="panel settings-panel">
      <div class="panel-heading">
        <h2><UIcon name="i-lucide-volume-2" />播放偏好</h2>
        <UBadge color="neutral" variant="soft">LOCAL</UBadge>
      </div>
      <div class="setting-row">
        <div>
          <strong>默认音量</strong>
          <p>下一次打开播放器时使用</p>
        </div>
        <div class="range-label">
          <USlider
            v-model="settings.volume"
            aria-label="默认音量"
            :min="0"
            :max="1"
            :step="0.05"
            @change="save"
          /><span>{{ Math.round(settings.volume * 100) }}%</span>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <strong>默认倍速</strong>
          <p>也可以在播放时随时调整</p>
        </div>
        <USelect
          v-model="settings.rate"
          :items="
            [0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => ({
              label: value + '×',
              value,
            }))
          "
          aria-label="默认倍速"
          class="w-28"
          @change="save"
        />
      </div>
      <div class="setting-row">
        <div>
          <strong>显示弹幕</strong>
          <p>开启后展示你导入的本地弹幕</p>
        </div>
        <USwitch
          v-model="settings.danmaku"
          color="success"
          aria-label="默认显示弹幕"
          @change="save"
        />
      </div>
      <div class="setting-row">
        <div>
          <strong>弹幕透明度</strong>
          <p>让弹幕与画面保持舒服的距离</p>
        </div>
        <div class="range-label">
          <USlider
            v-model="settings.danmakuOpacity"
            aria-label="弹幕透明度"
            :min="0"
            :max="1"
            :step="0.05"
            @change="save"
          /><span>{{ Math.round(settings.danmakuOpacity * 100) }}%</span>
        </div>
      </div>
    </GlassCard>
    <GlassCard class="panel settings-panel">
      <div class="panel-heading">
        <h2><UIcon name="i-lucide-clock-3" />本地观看记录</h2>
        <span class="muted">{{ records.length }} 条记录</span>
      </div>
      <div class="setting-row">
        <div>
          <strong>带上你的进度</strong>
          <p>导出 JSON 文件，在另一台设备上导入。导入时保留更新的记录。</p>
        </div>
        <div class="setting-actions">
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-download"
            @click="download"
            >导出</UButton
          ><label class="button secondary file-button"
            ><UIcon name="i-lucide-upload" />导入<input
              type="file"
              accept=".json,application/json"
              aria-label="导入观看记录"
              @change="upload"
          ></label>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <strong>清空观看记录</strong>
          <p>仅清空进度，保留播放偏好、自定义地址和本地弹幕。</p>
        </div>
        <UButton
          color="error"
          variant="soft"
          icon="i-lucide-trash-2"
          @click="confirmClear = true"
          >清空记录</UButton
        >
      </div>
    </GlassCard>
    <UModal
      v-model:open="confirmClear"
      title="清空观看记录？"
      description="清空后只能通过已导出的文件恢复。播放偏好、自定义地址和弹幕会保留。"
      ><template #footer
        ><div class="flex justify-end gap-3 w-full">
          <UButton color="neutral" variant="soft" @click="confirmClear = false"
            >取消</UButton
          ><UButton color="error" @click="clear">确认清空</UButton>
        </div></template
      ></UModal
    >
    <GlassCard class="panel"
      ><div class="about-panel">
        <span class="privacy-icon"><UIcon name="i-lucide-shield-check" /></span>
        <div>
          <h2>简单一点，自在一点。</h2>
          <p>
            本站没有账户系统，也不会上传你的观看进度。清除浏览器站点数据、使用无痕模式或更换站点域名，可能使本地记录不可用。重要进度可以定期导出。
          </p>
          <p>
            番剧资料来自
            Bangumi；在线资源来自独立第三方视频源，实际可用性随上游变化。播放器体验页使用明确标注的公开测试视频。
          </p>
          <UButton
            to="/sources"
            color="neutral"
            variant="link"
            trailing-icon="i-lucide-arrow-right"
            class="mt-3"
            >管理播放源</UButton
          >
        </div>
      </div></GlassCard
    >
  </div>
</template>
