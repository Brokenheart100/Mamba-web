import { createHash } from "node:crypto";
import { createDandanplayClient } from "../providers/danmaku/dandanplay";
import type { DanmakuServiceStatus } from "#shared/types/online-danmaku";

let client: ReturnType<typeof createDandanplayClient> | undefined;
let clientKey = "";
export function danmakuServiceStatus(): DanmakuServiceStatus {
  const config = useRuntimeConfig();
  if (String(config.dandanplayEnabled) === "false")
    return {
      available: false,
      state: "disabled",
      message: "站点暂时关闭了在线弹幕，仍可导入本地文件。",
    };
  if (
    !String(config.dandanplayAppId || "").trim() ||
    !String(config.dandanplayAppSecret || "").trim()
  )
    return {
      available: false,
      state: "unconfigured",
      message: "站点尚未配置在线弹幕，仍可导入本地文件。",
    };
  return {
    available: true,
    state: "ready",
    message: "弹幕由弹弹play开放弹幕网络提供。",
  };
}
export function dandanplayClient() {
  const status = danmakuServiceStatus();
  if (!status.available)
    throw createError({ statusCode: 503, message: status.message });
  const config = useRuntimeConfig();
  const appId = String(config.dandanplayAppId).trim();
  const secret = String(config.dandanplayAppSecret).trim();
  const extraCdnHosts = String(config.dandanplayCdnHosts || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  const key = createHash("sha256")
    .update(JSON.stringify([appId, secret, extraCdnHosts]))
    .digest("hex");
  if (!client || key !== clientKey) {
    client = createDandanplayClient({ appId, secret, extraCdnHosts });
    clientKey = key;
  }
  return client;
}
