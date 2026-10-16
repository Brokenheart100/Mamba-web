import { getSubject } from "../../../providers/metadata/bangumi";
export default defineEventHandler((event) => getSubject(routeId(event)));
