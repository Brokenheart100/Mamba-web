import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sourceById, validClaimPath } from "../providers/video/catalog";

export interface ResourceClaim {
  sourceId?: string;
  subjectId: number;
  episodeId: number;
  path: string;
  channel: string;
  expires: number;
}
const localSecret = randomBytes(32).toString("hex");
function secret() {
  return useRuntimeConfig().playbackSecret || localSecret;
}
function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signResource(claim: Omit<ResourceClaim, "expires">): string {
  const payload = Buffer.from(
    JSON.stringify({ ...claim, expires: Date.now() + 60 * 60 * 1000 }),
  ).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyResource(token: string): ResourceClaim {
  const [payload, mac, extra] = token.split(".");
  if (!payload || !mac || extra || token.length > 3000)
    throw createError({
      statusCode: 400,
      message: "播放资源无效，请重新选择线路。",
    });
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(mac);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw createError({ statusCode: 400, message: "播放资源签名无效。" });
  let claim: ResourceClaim;
  try {
    claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw createError({ statusCode: 400, message: "播放资源格式无效。" });
  }
  if (
    !Number.isSafeInteger(claim.subjectId) ||
    !Number.isSafeInteger(claim.episodeId) ||
    !sourceById(claim.sourceId || "xifan") ||
    !validClaimPath(sourceById(claim.sourceId || "xifan")!, claim.path) ||
    typeof claim.channel !== "string" ||
    !Number.isFinite(claim.expires)
  )
    throw createError({ statusCode: 400, message: "播放资源格式无效。" });
  if (claim.expires < Date.now())
    throw createError({
      statusCode: 410,
      message: "线路信息已过期，请刷新线路列表。",
    });
  return claim;
}
