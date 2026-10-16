import { openDB, type DBSchema } from "idb";
import type {
  DanmakuSelection,
  OnlineDanmakuResult,
} from "#shared/types/online-danmaku";
import { danmakuId, validateDanmakuMatch } from "#shared/utils/online-danmaku";
import { validateDanmaku } from "#shared/utils/danmaku";

interface OnlineDanmakuDB extends DBSchema {
  selections: { key: string; value: DanmakuSelection };
  cache: {
    key: string;
    value: OnlineDanmakuResult;
    indexes: { "by-fetched": number };
  };
}
const db = () =>
  openDB<OnlineDanmakuDB>("ani-online-danmaku", 1, {
    upgrade(database) {
      database.createObjectStore("selections");
      database
        .createObjectStore("cache")
        .createIndex("by-fetched", "fetchedAt");
    },
  });
export async function readDanmakuSelection(
  key: string,
): Promise<DanmakuSelection> {
  const connection = await db();
  try {
    const row = await connection.get("selections", key);
    return {
      mode: row?.mode === "online" ? "online" : "local",
      ...(row?.match ? { match: validateDanmakuMatch(row.match) } : {}),
    };
  } finally {
    connection.close();
  }
}
export async function saveDanmakuSelection(
  key: string,
  selection: DanmakuSelection,
) {
  const connection = await db();
  try {
    await connection.put(
      "selections",
      {
        mode: selection.mode,
        ...(selection.match
          ? { match: validateDanmakuMatch(selection.match) }
          : {}),
      },
      key,
    );
  } finally {
    connection.close();
  }
}
export function validateOnlineDanmaku(
  value: OnlineDanmakuResult,
): OnlineDanmakuResult {
  const episodeId = danmakuId(value.episodeId);
  if (!Number.isFinite(value.fetchedAt) || value.fetchedAt <= 0)
    throw new Error("弹幕缓存时间无效。");
  return {
    episodeId,
    items: validateDanmaku(value.items),
    fetchedAt: value.fetchedAt,
    skipped:
      Number.isSafeInteger(value.skipped) && value.skipped >= 0
        ? value.skipped
        : 0,
    truncated: value.truncated === true,
  };
}
export async function readOnlineDanmakuCache(id: string) {
  const connection = await db();
  try {
    const row = await connection.get("cache", danmakuId(id));
    if (!row) return undefined;
    const result = validateOnlineDanmaku(row);
    if (result.episodeId !== danmakuId(id))
      throw new Error("弹幕缓存与当前弹幕库不一致。");
    return result;
  } finally {
    connection.close();
  }
}
export async function saveOnlineDanmakuCache(value: OnlineDanmakuResult) {
  const row = validateOnlineDanmaku(value);
  const connection = await db();
  try {
    const tx = connection.transaction("cache", "readwrite");
    await tx.store.put(row, row.episodeId);
    // Retain at most twenty episode pools, evicting the oldest cached data.
    let count = await tx.store.count();
    let cursor = await tx.store.index("by-fetched").openCursor();
    while (cursor && count > 20) {
      await cursor.delete();
      count--;
      cursor = await cursor.continue();
    }
    await tx.done;
  } finally {
    connection.close();
  }
}
