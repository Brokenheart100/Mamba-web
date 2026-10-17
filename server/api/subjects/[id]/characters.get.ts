import { getSubjectCharacters } from "../../../providers/metadata/bangumi";
export default defineEventHandler((event) => getSubjectCharacters(routeId(event)));
