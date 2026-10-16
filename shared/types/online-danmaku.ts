import type { Danmaku } from "./media";

export interface DanmakuMatch {
  animeId: string;
  episodeId: string;
  animeTitle: string;
  episodeTitle: string;
  episodeNumber?: string;
  seasonTitle?: string;
}
export interface DanmakuSearchResult {
  matches: DanmakuMatch[];
  hasMore: boolean;
}
export interface OnlineDanmakuResult {
  episodeId: string;
  items: Danmaku[];
  fetchedAt: number;
  skipped: number;
  truncated: boolean;
}
export interface DanmakuSelection {
  mode: "local" | "online";
  match?: DanmakuMatch;
}
export interface DanmakuServiceStatus {
  available: boolean;
  state: "ready" | "disabled" | "unconfigured";
  message: string;
}
