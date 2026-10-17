import { discoveryQuerySchema } from "#shared/schemas/discovery";
import { browseDiscovery } from "../../providers/metadata/bangumi";
export default defineEventHandler(async (event) => {
  const filters = await getValidatedQuery(event, discoveryQuerySchema.parse).catch(() => {
    throw createError({ statusCode: 400, message: "新番或榜单筛选条件无效，请重新选择。" });
  });
  return browseDiscovery(filters);
});
