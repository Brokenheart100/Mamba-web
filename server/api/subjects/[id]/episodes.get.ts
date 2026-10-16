import { getEpisodes } from "../../../providers/metadata/bangumi";
export default defineEventHandler((event) => getEpisodes(routeId(event)));
