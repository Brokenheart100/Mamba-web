import { categoryQuerySchema } from "#shared/schemas/categories";
import { browseAnime } from "../../providers/metadata/bangumi";

export default defineEventHandler(async (event) => {
  const filters = await getValidatedQuery(event, categoryQuerySchema.parse).catch(() => {
    throw createError({ statusCode: 400, message: "分类筛选条件无效，请重新选择分类或年份。" });
  });
  return browseAnime(filters);
});
