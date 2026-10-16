import snapshot from "./source-catalog.json";
import type { SourceState, VideoSourceInfo } from "#shared/types/media";

export interface SourceDefinition {
  id: string;
  name: string;
  origin: string;
  allowedOrigins: string[];
  tier: number;
  searchPath: string;
  search: {
    kind: string;
    anchors: string;
    names: string;
    links: string;
    jsonLinkTemplate: string;
  };
  chapters: { names: string; groups: string; episodes: string; links: string };
  defaultEnabled: boolean;
  initialStatus: SourceState;
  note: string;
}
export const sourceDefinitions = snapshot.sources as SourceDefinition[];
export const sourceSnapshot = snapshot.updatedAt;
export function sourceById(id: string): SourceDefinition | undefined {
  return sourceDefinitions.find((source) => source.id === id);
}
export function publicSources(): VideoSourceInfo[] {
  return sourceDefinitions.map((source) => ({
    id: source.id,
    name: source.name,
    website: source.origin,
    tier: source.tier,
    defaultEnabled: source.defaultEnabled,
    initialStatus: source.initialStatus,
    note: source.note,
  }));
}
export function sourcePath(
  source: SourceDefinition,
  value: string,
): string | undefined {
  try {
    if (!value || value.length > 1800 || /[\\\r\n]/.test(value)) return;
    const url = new URL(value, source.origin);
    if (
      !source.allowedOrigins.includes(url.origin) ||
      url.username ||
      url.password ||
      !["http:", "https:"].includes(url.protocol)
    )
      return;
    return url.pathname + url.search;
  } catch {
    return;
  }
}
export function validClaimPath(
  source: SourceDefinition,
  path: string,
): boolean {
  return (
    typeof path === "string" &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    sourcePath(source, path) === path &&
    !path.includes("#")
  );
}
