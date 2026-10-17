import { getRelatedSubjects } from "../../../providers/metadata/bangumi";
export default defineEventHandler((event) => getRelatedSubjects(routeId(event)));
