import { dandanplayClient } from "../../utils/dandanplay";
export default defineEventHandler((event) => {
  const query = getQuery(event);
  const id =
    typeof query.subjectId === "string" &&
    /^[1-9]\d{0,9}$/.test(query.subjectId)
      ? Number(query.subjectId)
      : 0;
  if (!id || id > 2147483647)
    throw createError({ statusCode: 400, message: "Bangumi 条目编号无效。" });
  setHeader(event, "Cache-Control", "no-store");
  return dandanplayClient().match(id);
});
