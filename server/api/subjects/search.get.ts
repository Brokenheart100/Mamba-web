import { searchSubjects } from "../../providers/metadata/bangumi";
export default defineEventHandler((event) => {
  const query = getQuery(event);
  const keyword = String(query.q || "").trim();
  const offset = Number(query.offset || 0);
  if (
    !keyword ||
    keyword.length > 100 ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 1000
  )
    throw createError({
      statusCode: 400,
      message: "请输入 1～100 字的关键词，分页范围不超过 1000。",
    });
  return searchSubjects(keyword, offset);
});
