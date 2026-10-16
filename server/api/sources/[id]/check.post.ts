import { sourceById } from "../../../providers/video/catalog";
import { checkSource } from "../../../providers/video/selector-provider";
export default defineEventHandler(async (event) => {
  if (String(useRuntimeConfig().sourceEnabled) === "false")
    throw createError({ statusCode: 503, message: "在线源已关闭。" });
  const id = getRouterParam(event, "id") || "";
  if (!sourceById(id))
    throw createError({ statusCode: 400, message: "没有登记这个视频源。" });
  setHeader(event, "Cache-Control", "no-store");
  return checkSource(id);
});
