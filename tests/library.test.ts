import "fake-indexeddb/auto";
import { openDB } from "idb";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearProgress,
  exportProgress,
  getProgress,
  importProgress,
  listProgress,
  saveProgress,
  setCompleted,
  getSettings,
  saveSettings,
} from "../app/repositories/local-library";
import type { WatchProgress } from "../shared/types/media";
import {
  nextProgress,
  normalizeTitle,
  parseBackup,
  safeMediaUrl,
} from "../shared/utils/media";

const record = (overrides: Partial<WatchProgress> = {}): WatchProgress => ({
  key: "400602:1227087",
  subjectId: 400602,
  episodeId: 1227087,
  subjectName: "葬送的芙莉莲",
  episodeName: "冒险结束",
  image: "https://example.com/cover.jpg",
  sort: 1,
  position: 123,
  duration: 1560,
  completed: false,
  updatedAt: 1000,
  sourceId: "xifan",
  channel: "备用①",
  ...overrides,
});
beforeEach(clearProgress);

describe("local progress", () => {
  it("ignores corrupted stored records without losing valid history", async () => {
    await saveProgress(record());
    const connection = await openDB("ani-local-library", 1);
    await connection.put("progress", record({ key: "400602:99", episodeId: 99, position: -1 }));
    connection.close();
    expect(await getProgress("400602:99")).toBeUndefined();
    expect(await listProgress()).toEqual([record()]);
  });
  it("reads existing v1 settings and persists new player preferences without a database migration", async () => {
    const connection = await openDB("ani-local-library", 1);
    await connection.put(
      "settings",
      {
        volume: 0,
        rate: 1.5,
        danmaku: false,
        danmakuOpacity: 0.45,
        danmakuOffset: -2,
      },
      "player",
    );
    connection.close();
    const settings = await getSettings();
    expect(settings).toMatchObject({
      volume: 0,
      rate: 1.5,
      danmaku: false,
      danmakuFontSize: 24,
      danmakuAntiOverlap: true,
    });
    await saveSettings({
      ...settings,
      danmakuFontSize: 32,
      danmakuAntiOverlap: false,
      danmakuArea: 0.5,
    });
    expect(await getSettings()).toMatchObject({
      volume: 0,
      rate: 1.5,
      danmakuFontSize: 32,
      danmakuAntiOverlap: false,
      danmakuArea: 0.5,
    });
  });
  it("persists a position and exports a versioned backup", async () => {
    await saveProgress(record());
    expect((await getProgress("400602:1227087"))?.position).toBe(123);
    expect(parseBackup(await exportProgress())).toEqual([record()]);
  });
  it("allows intentional rewinds without losing completion", async () => {
    await saveProgress(record({ completed: true }));
    await saveProgress(record({ position: 50, updatedAt: 2000 }));
    expect(await getProgress("400602:1227087")).toMatchObject({
      position: 50,
      completed: true,
    });
  });
  it("does not let a delayed older write replace a newer position", () => {
    expect(
      nextProgress(
        record({ position: 300, updatedAt: 3000 }),
        record({ position: 100, updatedAt: 2000 }),
      ).position,
    ).toBe(300);
  });
  it("supports manually clearing completion", async () => {
    await saveProgress(record({ completed: true }));
    await setCompleted("400602:1227087", false);
    expect((await getProgress("400602:1227087"))?.completed).toBe(false);
  });
  it("merges imports by timestamp without replacing newer local records", async () => {
    await saveProgress(record({ position: 300, updatedAt: 3000 }));
    await importProgress(
      JSON.stringify({
        version: 1,
        progress: [record({ position: 10, updatedAt: 1000 })],
      }),
    );
    expect((await getProgress("400602:1227087"))?.position).toBe(300);
  });
  it("validates the entire import before writing any record", async () => {
    await saveProgress(record());
    const backup = {
      version: 1,
      progress: [
        record({ position: 800, updatedAt: 8000 }),
        record({ key: "wrong", episodeId: 99 }),
      ],
    };
    await expect(importProgress(JSON.stringify(backup))).rejects.toThrow();
    expect(await listProgress()).toEqual([record()]);
  });
  it("rejects unsupported backups and invalid date ranges", () => {
    expect(() =>
      parseBackup(JSON.stringify({ version: 2, progress: [] })),
    ).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify({ version: 1, progress: [record({ updatedAt: 1e20 })] }),
      ),
    ).toThrow();
  });
});

describe("source identities", () => {
  it("normalizes punctuation without merging seasons", () => {
    expect(normalizeTitle("ＡＢＣ！")).toBe(normalizeTitle("abc"));
    expect(normalizeTitle("葬送的芙莉莲 第二季")).not.toBe(
      normalizeTitle("葬送的芙莉莲"),
    );
  });
  it("rejects script URLs, plain HTTP and embedded credentials", () => {
    for (const url of [
      "javascript:alert(1)",
      "http://example.com/a.mp4",
      "https://user:pass@example.com/a.mp4",
    ])
      expect(() => safeMediaUrl(url)).toThrow();
    expect(safeMediaUrl("https://example.com/a.m3u8")).toBe(
      "https://example.com/a.m3u8",
    );
  });
});
