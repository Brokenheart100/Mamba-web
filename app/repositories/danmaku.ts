import { openDB } from "idb";
import type { Danmaku } from "#shared/types/media";
import { validateDanmaku } from "#shared/utils/danmaku";

const db = () =>
  openDB("ani-local-danmaku", 1, {
    upgrade(database) {
      database.createObjectStore("episodes");
    },
  });
export async function readDanmaku(key: string): Promise<Danmaku[]> {
  const connection = await db();
  try {
    return (await connection.get("episodes", key)) || [];
  } finally {
    connection.close();
  }
}
export async function storeDanmaku(key: string, items: Danmaku[]) {
  const connection = await db();
  try {
    await connection.put("episodes", items, key);
  } finally {
    connection.close();
  }
}

export async function importDanmaku(file: File): Promise<Danmaku[]> {
  if (file.size > 5_000_000) throw new Error("请选择 5 MB 以内的弹幕文件。");
  const text = await file.text();
  if (file.name.toLowerCase().endsWith(".json"))
    return validateDanmaku(JSON.parse(text));
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.querySelector("parsererror"))
    throw new Error("XML 弹幕文件无法解析。");
  const rows = [...document.querySelectorAll("d")].map((item) => {
    const parts = (item.getAttribute("p") || "").split(",");
    const rgb = Number(parts[3]);
    return {
      time: Number(parts[0]),
      text: item.textContent || "",
      color:
        Number.isInteger(rgb) && rgb >= 0 && rgb <= 0xffffff
          ? `#${rgb.toString(16).padStart(6, "0")}`
          : "#ffffff",
      mode: parts[1] === "5" ? "top" : parts[1] === "4" ? "bottom" : "scroll",
    };
  });
  if (!rows.length)
    throw new Error("文件中没有找到弹幕，支持 Bilibili 格式 XML 或 Ani JSON。");
  return validateDanmaku(rows);
}
