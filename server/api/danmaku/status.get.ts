import { danmakuServiceStatus } from "../../utils/dandanplay";
export default defineEventHandler((event) => {
  setHeader(event, "Cache-Control", "no-store");
  return danmakuServiceStatus();
});
