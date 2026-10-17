import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { PlayerSettings, WatchProgress } from "#shared/types/media";
import { watchProgressSchema } from "#shared/schemas/media";
import {
  nextProgress,
  parseBackup,
  safeMediaUrl,
  normalizeSettings,
} from "#shared/utils/media";

interface LibraryDB extends DBSchema {
  progress: {
    key: string;
    value: WatchProgress;
    indexes: { "by-updated": number };
  };
  settings: { key: string; value: PlayerSettings };
  bindings: {
    key: string;
    value: { key: string; url: string; transport: "mp4" | "hls" };
  };
}
let database: Promise<IDBPDatabase<LibraryDB>> | undefined;
function db() {
  if (typeof indexedDB === "undefined")
    return Promise.reject(new Error("此浏览器无法使用本地存储。"));
  database ||= openDB<LibraryDB>("ani-local-library", 1, {
    upgrade(database) {
      const store = database.createObjectStore("progress", { keyPath: "key" });
      store.createIndex("by-updated", "updatedAt");
      database.createObjectStore("settings");
      database.createObjectStore("bindings", { keyPath: "key" });
    },
    blocking() {
      void database?.then((connection) => connection.close());
      database = undefined;
    },
    terminated() {
      database = undefined;
    },
  }).catch((error) => {
    database = undefined;
    throw error;
  });
  return database;
}

export async function listProgress(): Promise<WatchProgress[]> {
  const rows = await (await db()).getAllFromIndex("progress", "by-updated");
  return rows.flatMap((row) => {
    const parsed = watchProgressSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  }).reverse();
}
export async function getProgress(key: string) {
  const parsed = watchProgressSchema.safeParse(await (await db()).get("progress", key));
  return parsed.success ? parsed.data : undefined;
}
export async function saveProgress(row: WatchProgress) {
  row = watchProgressSchema.parse(row);
  const tx = (await db()).transaction("progress", "readwrite");
  const previous = await tx.store.get(row.key);
  await tx.store.put(nextProgress(previous, row));
  await tx.done;
}
export async function setCompleted(key: string, value: boolean) {
  const tx = (await db()).transaction("progress", "readwrite");
  const row = await tx.store.get(key);
  if (row)
    await tx.store.put({ ...row, completed: value, updatedAt: Date.now() });
  await tx.done;
}
export async function deleteProgress(key: string) {
  await (await db()).delete("progress", key);
}
export async function clearProgress() {
  await (await db()).clear("progress");
}
export async function exportProgress() {
  return JSON.stringify(
    {
      app: "mamba-animation",
      version: 1,
      exportedAt: new Date().toISOString(),
      progress: await listProgress(),
    },
    null,
    2,
  );
}
export async function importProgress(text: string) {
  const rows = parseBackup(text);
  const tx = (await db()).transaction("progress", "readwrite");
  for (const row of rows) {
    const previous = await tx.store.get(row.key);
    if (!previous || row.updatedAt > previous.updatedAt)
      await tx.store.put(row);
  }
  await tx.done;
  return rows.length;
}
export async function getSettings(): Promise<PlayerSettings> {
  const row = await (await db()).get("settings", "player");
  return normalizeSettings(row);
}
export async function saveSettings(settings: PlayerSettings) {
  await (await db()).put("settings", normalizeSettings(settings), "player");
}
export async function getBinding(key: string) {
  return (await db()).get("bindings", key);
}
export async function saveBinding(
  key: string,
  url: string,
  transport: "mp4" | "hls",
) {
  await (
    await db()
  ).put("bindings", { key, url: safeMediaUrl(url), transport });
}
export async function deleteBinding(key: string) {
  await (await db()).delete("bindings", key);
}
