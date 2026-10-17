import { consola } from "consola";
import { getResponseStatus } from "h3";
import type { H3Event } from "h3";

export default defineNitroPlugin((nitro) => {
  const log = consola.withTag("Mamba");
  const config = useRuntimeConfig();
  const configured = Boolean(String(config.dandanplayAppId || "").trim() && String(config.dandanplayAppSecret || "").trim());
  const danmaku = String(config.dandanplayEnabled) === "false" ? "disabled"
    : configured ? "configured (auth not checked)" : "not configured (local files available)";
  log.box([
    "🐍 Mamba-Animation",
    "🚀 Server initialized",
    "💬 Danmaku: " + danmaku,
    "🎬 Sources: " + (String(config.sourceEnabled) === "false" ? "disabled" : "enabled"),
    "🔒 Watch history: browser only",
  ].join("\n"));

  const started = new WeakMap<H3Event, number>();
  nitro.hooks.hook("request", (event) => {
    if (event.path.startsWith("/api/")) started.set(event, performance.now());
  });
  function writeRequest(event: H3Event, status: number, responseBody?: unknown) {
    const start = started.get(event);
    if (start === undefined) return;
    started.delete(event);
    // Log the router's static pattern, never raw URLs, query strings or IDs.
    const path = event.context.matchedRoute?.path || "/api/*";
    if (path === "/api/health" && status < 400) return;
    const elapsed = Math.max(0, Math.round(performance.now() - start));
    const icon = status >= 500 ? "❌" : status >= 400 ? "⚠️" : elapsed >= 3000 ? "🐢"
      : path.startsWith("/api/danmaku") ? "💬" : path.startsWith("/api/subjects") || path === "/api/calendar" ? "📚" : "🎬";
    let summary = "";
    // Only counts from known response shapes; never serialize response content.
    if (status < 400 && responseBody && typeof responseBody === "object") {
      const body = responseBody as Record<string, unknown>;
      if (path.startsWith("/api/danmaku") && Array.isArray(body.items)) summary = ` · ${body.items.length} 条弹幕`;
      else if (path.startsWith("/api/danmaku") && Array.isArray(body.matches)) summary = ` · ${body.matches.length} 个候选`;
      else if (path.endsWith("/comments") && Array.isArray(body.data)) summary = ` · ${body.data.length} 条评论`;
      else if (path.startsWith("/api/subjects") && Array.isArray(body.data)) summary = ` · ${body.data.length} 部作品`;
    }
    const message = `${icon} ${event.method.padEnd(4)} ${path} · ${status} · ${elapsed} ms${summary}`;
    if (status >= 500) log.error(message);
    else if (status >= 400 || elapsed >= 3000) log.warn(message);
    else log.info(message);
  }
  nitro.hooks.hook("afterResponse", (event, response) => {
    writeRequest(event, getResponseStatus(event), response?.body);
  });
  nitro.hooks.hook("error", (error, context) => {
    // H3 does not always run afterResponse for thrown errors. Removing the
    // start time ensures a request is still logged at most once.
    if (context.event) {
      const code = (error as { statusCode?: number }).statusCode;
      writeRequest(context.event, typeof code === "number" && code >= 400 && code <= 599 ? code : 500);
    } else {
      log.error("❌ 后台任务异常 · 请检查服务状态");
    }
  });
  nitro.hooks.hook("close", () => { log.info("👋 服务已停止 · 下次放映见"); });
});
