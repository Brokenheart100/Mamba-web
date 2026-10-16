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
export interface WatchProgress {
  key: string;
  subjectId: number;
  episodeId: number;
  subjectName: string;
  episodeName: string;
  image: string;
  sort: number;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: number;
  sourceId: string;
  channel: string;
}
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
export interface Danmaku {
  id: string;
  time: number;
  text: string;
  color: string;
  mode: "scroll" | "top" | "bottom";
}
export interface DanmakuResult {
  items: Danmaku[];
  message: string;
}
