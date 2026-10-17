import { danmakuParamsSchema } from "#shared/schemas/requests";
import { dandanplayClient } from "../../utils/dandanplay";
export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, danmakuParamsSchema.parse)
    .catch(() => {
      throw createError({ statusCode: 400, message: "弹幕库编号无效。" });
    });
  setHeader(event, "Cache-Control", "no-store");
  return dandanplayClient().comments(id);
});
