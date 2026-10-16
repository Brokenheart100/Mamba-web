import type { PlayerSettings, WatchProgress } from "../types/media";

export const defaultSettings: PlayerSettings = {
  volume: 0.75,
  rate: 1,
  danmaku: true,
  danmakuOpacity: 0.8,
  danmakuOffset: 0,
  danmakuFontSize: 24,
  danmakuSpeed: 6,
  danmakuArea: 0.75,
  danmakuAntiOverlap: true,
  danmakuSync: true,
  danmakuModes: ["scroll", "top", "bottom"],
};

export function normalizeSettings(
  row: Partial<PlayerSettings> = {},
): PlayerSettings {
  const bounded = (
    value: number | undefined,
    min: number,
    max: number,
    fallback: number,
  ) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : fallback;
  return {
    volume: bounded(row.volume, 0, 1, defaultSettings.volume),
    rate: [0.5, 0.75, 1, 1.25, 1.5, 2].includes(row.rate ?? 0) ? row.rate! : 1,
    danmaku: typeof row.danmaku === "boolean" ? row.danmaku : true,
    danmakuOpacity: bounded(row.danmakuOpacity, 0, 1, 0.8),
    danmakuOffset: bounded(row.danmakuOffset, -300, 300, 0),
    danmakuFontSize: bounded(row.danmakuFontSize, 12, 36, 24),
    danmakuSpeed: bounded(row.danmakuSpeed, 1, 10, 6),
    danmakuArea: bounded(row.danmakuArea, 0.1, 1, 0.75),
    danmakuAntiOverlap:
      typeof row.danmakuAntiOverlap === "boolean"
        ? row.danmakuAntiOverlap
        : true,
    danmakuSync: typeof row.danmakuSync === "boolean" ? row.danmakuSync : true,
    danmakuModes: Array.isArray(row.danmakuModes)
      ? [
          ...new Set(
            row.danmakuModes.filter((mode) =>
              ["scroll", "top", "bottom"].includes(mode),
            ),
          ),
        ]
      : [...defaultSettings.danmakuModes],
  };
}

export function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "00:00";
  const seconds = Math.floor(value);
  const minutes = Math.floor(seconds / 60);
  return `${minutes.toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function normalizeTitle(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{P}\p{Z}\p{S}\s]/gu, "");
}

export function progressKey(subjectId: number, episodeId: number): string {
  return `${subjectId}:${episodeId}`;
}

export function isProgress(value: unknown): value is WatchProgress {
  if (!value || typeof value !== "object") return false;
  const row = value as WatchProgress;
  return (
    Number.isSafeInteger(row.subjectId) &&
    row.subjectId > 0 &&
    Number.isSafeInteger(row.episodeId) &&
    row.episodeId > 0 &&
    row.key === progressKey(row.subjectId, row.episodeId) &&
    ["subjectName", "episodeName", "image", "sourceId", "channel"].every(
      (k) =>
        typeof (row as unknown as Record<string, unknown>)[k] === "string" &&
        String((row as unknown as Record<string, unknown>)[k]).length < 4000,
    ) &&
    [row.position, row.duration, row.sort, row.updatedAt].every(
      (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
    ) &&
    row.updatedAt <= 8_640_000_000_000_000 &&
    typeof row.completed === "boolean"
  );
}

export function parseBackup(text: string): WatchProgress[] {
  if (text.length > 5_000_000)
    throw new Error("文件过大，请选择 5 MB 以内的记录文件。");
  const backup: unknown = JSON.parse(text);
  if (
    !backup ||
    typeof backup !== "object" ||
    !("version" in backup) ||
    backup.version !== 1 ||
    !("progress" in backup) ||
    !Array.isArray(backup.progress)
  )
    throw new Error("这不是受支持的 Ani 观看记录文件。");
  if (backup.progress.length > 10_000 || !backup.progress.every(isProgress))
    throw new Error("记录格式有误，原有记录没有被修改。");
  return backup.progress;
}

export function nextProgress(
  previous: WatchProgress | undefined,
  current: WatchProgress,
): WatchProgress {
  if (previous && previous.updatedAt > current.updatedAt) return previous;
  // Rewinding is intentional. Completion survives a later partial replay.
  return {
    ...current,
    completed: previous?.completed || current.completed || false,
  };
}

export function safeMediaUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("请输入不含账号密码的 HTTPS 视频地址。");
  return url.href;
}
