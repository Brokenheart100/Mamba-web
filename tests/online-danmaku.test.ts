import "fake-indexeddb/auto";
import { openDB } from "idb";
import { beforeEach, describe, expect, it } from "vitest";
import {
  readDanmakuSelection,
  saveDanmakuSelection,
  readOnlineDanmakuCache,
  saveOnlineDanmakuCache,
} from "../app/repositories/online-danmaku";
import { readDanmaku, storeDanmaku } from "../app/repositories/danmaku";
import type { OnlineDanmakuResult } from "../shared/types/online-danmaku";

const match = {
  animeId: "123",
  episodeId: "1230001",
  animeTitle: "番剧第二季",
  episodeTitle: "第1话",
};
const row = (id = "1230001", time = 1000): OnlineDanmakuResult => ({
  episodeId: id,
  items: [
    { id: "0", time: 0, text: "测试弹幕", color: "#ffffff", mode: "scroll" },
  ],
  fetchedAt: time,
  skipped: 0,
  truncated: false,
});
beforeEach(async () => {
  await readDanmakuSelection("init");
  const connection = await openDB("ani-online-danmaku", 1);
  await connection.clear("selections");
  await connection.clear("cache");
  connection.close();
});
describe("local online danmaku persistence", () => {
  it("remembers the confirmed pool without conflating local chapter and provider IDs", async () => {
    await saveDanmakuSelection("400602:1227087", { mode: "online", match });
    expect(await readDanmakuSelection("400602:1227087")).toEqual({
      mode: "online",
      match,
    });
    expect(await readDanmakuSelection("400602:1227088")).toEqual({
      mode: "local",
    });
  });
  it("switches back to local without deleting the saved online match or imported files", async () => {
    await storeDanmaku("400602:1227087", row().items);
    await saveOnlineDanmakuCache(row());
    await saveDanmakuSelection("400602:1227087", { mode: "local", match });
    expect((await readDanmakuSelection("400602:1227087")).match).toEqual(match);
    expect(await readDanmaku("400602:1227087")).toHaveLength(1);
    expect((await readOnlineDanmakuCache(match.episodeId))?.items).toHaveLength(
      1,
    );
  });
  it("evicts the oldest cached pools after twenty episodes", async () => {
    for (let i = 1; i <= 21; i++)
      await saveOnlineDanmakuCache(row(String(i), i));
    expect(await readOnlineDanmakuCache("1")).toBeUndefined();
    expect(await readOnlineDanmakuCache("21")).toBeDefined();
  });
  it("validates cached data before it reaches the player", async () => {
    const connection = await openDB("ani-online-danmaku", 1);
    await connection.put(
      "cache",
      { ...row(), items: [{ text: "bad" }] },
      match.episodeId,
    );
    connection.close();
    await expect(readOnlineDanmakuCache(match.episodeId)).rejects.toThrow();
    const secondConnection = await openDB("ani-online-danmaku", 1);
    await secondConnection.put("cache", row("999"), match.episodeId);
    secondConnection.close();
    await expect(readOnlineDanmakuCache(match.episodeId)).rejects.toThrow(
      "不一致",
    );
  });
});
