import { resolveSource } from "../../providers/video/selector-provider";
export default defineEventHandler(async (event) => {
  setHeader(event, "Cache-Control", "no-store");
  if (
    useRuntimeConfig().sourceEnabled === false ||
    String(useRuntimeConfig().sourceEnabled) === "false"
  )
    throw createError({ statusCode: 503, message: "站点的视频源已关闭。" });
  if (Number(getHeader(event, "content-length") || 0) > 4096)
    throw createError({ statusCode: 413, message: "请求过大。" });
  const body = await readBody(event);
  if (!body || typeof body.resourceId !== "string")
    throw createError({ statusCode: 400, message: "请选择有效的视频资源。" });
  return resolveSource(verifyResource(body.resourceId));
});
