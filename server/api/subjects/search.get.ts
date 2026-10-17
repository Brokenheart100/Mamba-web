import { searchSubjects } from "../../providers/metadata/bangumi";
import { subjectSearchQuerySchema } from "#shared/schemas/requests";
export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, subjectSearchQuerySchema.parse)
    .catch(() => {
      throw createError({
        statusCode: 400,
        message: "请输入 1～100 字的关键词，分页范围不超过 1000。",
      });
    });
  return searchSubjects(query.q, query.offset);
});
