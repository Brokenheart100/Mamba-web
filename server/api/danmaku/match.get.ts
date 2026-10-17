import { dandanplayClient } from "../../utils/dandanplay";
import { danmakuMatchQuerySchema } from "#shared/schemas/requests";
export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, danmakuMatchQuerySchema.parse)
    .catch(() => {
      throw createError({ statusCode: 400, message: "Bangumi 条目编号无效。" });
    });
  setHeader(event, "Cache-Control", "no-store");
  return dandanplayClient().match(query.subjectId);
});
