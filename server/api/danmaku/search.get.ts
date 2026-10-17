import { dandanplayClient } from "../../utils/dandanplay";
import { danmakuSearchQuerySchema } from "#shared/schemas/requests";
export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, danmakuSearchQuerySchema.parse)
    .catch(() => {
      throw createError({
        statusCode: 400,
        message: "请输入 2～100 字的番剧名；集数可留空，或填写正整数、C1 / S1 / O1。",
      });
    });
  setHeader(event, "Cache-Control", "no-store");
  return dandanplayClient().search(query.q, query.episode);
});
