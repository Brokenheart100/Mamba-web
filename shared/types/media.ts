import type { z } from "zod";
import type { watchProgressSchema } from "../schemas/media";
import type { danmakuSchema } from "../schemas/danmaku";

export interface Subject {
  id: number;
  name: string;
  originalName: string;
  image: string;
  summary: string;
  score: number;
  ratingCount: number;
  rank: number;
  date: string;
  platform: string;
  episodes: number;
  tags: string[];
}

export interface Episode {
  id: number;
  subjectId: number;
  name: string;
  sort: number;
  type: number;
  airdate: string;
  duration: string;
}

export interface CalendarDay {
  id: number;
  name: string;
  subjects: Subject[];
}
export interface SearchResult {
  data: Subject[];
  total: number;
  offset: number;
  limit: number;
}
export interface RelatedSubject {
  subject: Subject;
  type: number;
  relation: string;
}
export interface SubjectCharacter {
  id: number;
  name: string;
  image: string;
  relation: string;
  actors: { id: number; name: string; image: string }[];
}
export interface ResourceCandidate {
  id: string;
  sourceId: string;
  sourceName: string;
  subjectName: string;
  episodeName: string;
  channel: string;
  match: "exact" | "confirm";
}
export interface ResourceResult {
  resources: ResourceCandidate[];
  message: string;
  sourceUrl: string;
  source?: SourceCheck;
}
export type SourceState =
  | "searchable"
  | "empty"
  | "challenge"
  | "unavailable"
  | "unsupported"
  | "unverified";
export interface VideoSourceInfo {
  id: string;
  name: string;
  website: string;
  tier: number;
  defaultEnabled: boolean;
  initialStatus: SourceState;
  note: string;
}
export interface SourceCheck {
  id: string;
  state: SourceState;
  message: string;
  count: number;
  checkedAt: number;
}
export interface PlaybackDescriptor {
  url: string;
  transport: "mp4" | "hls";
  sourceName: string;
  channel: string;
}
export type WatchProgress = z.infer<typeof watchProgressSchema>;
export interface PlayerSettings {
  volume: number;
  rate: number;
  danmaku: boolean;
  danmakuOpacity: number;
  danmakuOffset: number;
  danmakuFontSize: number;
  danmakuSpeed: number;
  danmakuArea: number;
  danmakuAntiOverlap: boolean;
  danmakuSync: boolean;
  danmakuModes: Danmaku["mode"][];
}
export type Danmaku = z.infer<typeof danmakuSchema>;
export interface DanmakuResult {
  items: Danmaku[];
  message: string;
}
