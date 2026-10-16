import { dandanplayClient } from "../../utils/dandanplay";
export default defineEventHandler((event) => {
  const query = getQuery(event);
  const keyword = typeof query.q === "string" ? query.q.trim() : "";
  const episode = typeof query.episode === "string" ? query.episode.trim() : "";
  if (
    keyword.length < 2 ||
    keyword.length > 100 ||
    (episode && !/^([1-9]\d{0,4}|[CSO][1-9]\d{0,3})$/.test(episode))
  )
    throw createError({
      statusCode: 400,
      message:
        "请输入 2～100 字的番剧名；集数可留空，或填写正整数、C1 / S1 / O1。",
    });
  setHeader(event, "Cache-Control", "no-store");
  return dandanplayClient().search(keyword, episode);
});
