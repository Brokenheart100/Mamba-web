import { getEpisode, getSubject } from "../../../providers/metadata/bangumi";
import {
  findSourceResources,
  SourceFailure,
} from "../../../providers/video/selector-provider";
import { sourceById } from "../../../providers/video/catalog";
import type { ResourceResult } from "#shared/types/media";
export default defineEventHandler(async (event): Promise<ResourceResult> => {
  setHeader(event, "Cache-Control", "no-store");
  if (
    useRuntimeConfig().sourceEnabled === false ||
    String(useRuntimeConfig().sourceEnabled) === "false"
  )
    return {
      resources: [],
      message: "站点的视频源已关闭。可以在本地添加视频地址。",
      sourceUrl: "",
    };
  const sourceId = String(getQuery(event).source || "xifan");
  const source = sourceById(sourceId);
  if (!source)
    throw createError({ statusCode: 400, message: "没有登记这个视频源。" });
  const episode = await getEpisode(routeId(event));
  const subject = await getSubject(episode.subjectId);
  try {
    const result = await findSourceResources(source, subject, episode);
    return {
      ...result,
      message: result.resources.length ? "" : result.source.message,
      sourceUrl: source.origin,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "此源暂时不可用。";
    return {
      resources: [],
      message,
      sourceUrl: source.origin,
      source: {
        id: source.id,
        state: error instanceof SourceFailure ? error.state : "unsupported",
        count: 0,
        message,
        checkedAt: Date.now(),
      },
    };
  }
});
