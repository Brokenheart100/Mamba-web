// Generate a reviewable proposal; the running app only loads its checked-in catalogue.
import { readFile, writeFile, mkdir } from "node:fs/promises";
const current = JSON.parse(
  await readFile("server/providers/video/source-catalog.json", "utf8"),
);
const input = process.argv[2];
let snapshot;
if (input) snapshot = JSON.parse(await readFile(input, "utf8"));
else {
  const response = await fetch("https://sub.creamycake.org/v1/css1.json", {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Subscription returned ${response.status}`);
  const text = await response.text();
  if (text.length > 2_000_000)
    throw new Error("Subscription exceeds the size limit");
  snapshot = JSON.parse(text);
}
const entries = snapshot.exportedMediaSourceDataList?.mediaSources;
if (!Array.isArray(entries))
  throw new Error("Unsupported subscription structure");
const sources = current.sources.map((source) => {
  const config = entries.find((entry) => entry.arguments?.name === source.name)
    ?.arguments?.searchConfig;
  if (!config) throw new Error(`Missing registered source: ${source.name}`);
  const searchUrl = new URL(config.searchUrl.replace("{keyword}", "{query}"));
  if (!source.allowedOrigins.includes(searchUrl.origin))
    throw new Error(`Review the new origin for ${source.name} before updating`);
  return {
    ...source,
    searchPath: decodeURI(searchUrl.pathname + searchUrl.search).replace(
      "{keyword}",
      "{query}",
    ),
    search: {
      kind:
        config.subjectFormatId === "json-path-indexed"
          ? "json"
          : config.subjectFormatId,
      anchors:
        source.id === "rebo"
          ? ".stui-vodlist__detail h4 a"
          : config.selectorSubjectFormatA?.selectLists || "",
      names: config.selectorSubjectFormatIndexed?.selectNames || "",
      links: config.selectorSubjectFormatIndexed?.selectLinks || "",
      jsonLinkTemplate:
        config.selectorSubjectFormatJsonPathIndexed?.linkTemplate || "",
    },
    chapters: {
      names: config.selectorChannelFormatFlattened?.selectChannelNames || "",
      groups:
        config.channelFormatId === "no-channel"
          ? ""
          : config.selectorChannelFormatFlattened?.selectEpisodeLists || "",
      episodes:
        config.channelFormatId === "no-channel"
          ? config.selectorChannelFormatNoChannel?.selectEpisodes || "a"
          : config.selectorChannelFormatFlattened?.selectEpisodesFromList ||
            "a",
      links:
        config.selectorChannelFormatFlattened?.selectEpisodeLinksFromList || "",
    },
  };
});
await mkdir("output/source-research", { recursive: true });
await writeFile(
  "output/source-research/catalog-proposed.json",
  JSON.stringify(
    { ...current, updatedAt: new Date().toISOString(), sources },
    null,
    2,
  ) + "\n",
);
console.log(
  `Prepared ${sources.length} source proposals in output/source-research/catalog-proposed.json; review before replacing the runtime catalogue.`,
);
