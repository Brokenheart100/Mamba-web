import { publicSources, sourceSnapshot } from "../../providers/video/catalog";
export default defineEventHandler(() => ({
  sources: publicSources(),
  updatedAt: sourceSnapshot,
  enabled: String(useRuntimeConfig().sourceEnabled) !== "false",
}));
