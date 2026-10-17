import type { z } from "zod";
import type { danmakuMatchSchema, danmakuSearchResultSchema, onlineDanmakuResultSchema, danmakuSelectionSchema } from "../schemas/danmaku";

export type DanmakuMatch = z.infer<typeof danmakuMatchSchema>;
export type DanmakuSearchResult = z.infer<typeof danmakuSearchResultSchema>;
export type OnlineDanmakuResult = z.infer<typeof onlineDanmakuResultSchema>;
export type DanmakuSelection = z.infer<typeof danmakuSelectionSchema>;
export interface DanmakuServiceStatus {
  available: boolean;
  state: "ready" | "disabled" | "unconfigured";
  message: string;
}
