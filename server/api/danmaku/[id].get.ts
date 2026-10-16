import { danmakuId } from "#shared/utils/online-danmaku";
import { dandanplayClient } from "../../utils/dandanplay";
export default defineEventHandler((event) => {
  let id: string;
  try {
    id = danmakuId(getRouterParam(event, "id"));
  } catch {
    throw createError({ statusCode: 400, message: "弹幕库编号无效。" });
  }
  setHeader(event, "Cache-Control", "no-store");
  return dandanplayClient().comments(id);
});
