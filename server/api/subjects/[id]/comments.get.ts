import { subjectCommentsQuerySchema } from "#shared/schemas/comments";
import { getSubjectComments } from "../../../providers/metadata/bangumi-comments";

export default defineEventHandler(async (event) => {
  const id = routeId(event);
  const query = await getValidatedQuery(event, subjectCommentsQuerySchema.parse).catch(() => {
    throw createError({ statusCode: 400, message: "评论页码无效，请重新选择。" });
  });
  return getSubjectComments(id, query.page);
});
