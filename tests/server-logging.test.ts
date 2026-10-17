import { createApp, createError, createRouter, eventHandler, toWebHandler } from "h3";
import { createHooks } from "hookable";
import type { NitroApp, NitroAppPlugin, NitroRuntimeHooks } from "nitropack/types";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const logger = vi.hoisted(() => ({ box: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock("consola", () => ({ consola: { withTag: () => logger } }));
let plugin: NitroAppPlugin;
beforeAll(async () => {
  vi.stubGlobal("defineNitroPlugin", (fn: NitroAppPlugin) => fn);
  plugin = (await import("../server/plugins/logging")).default;
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.stubGlobal("useRuntimeConfig", () => ({ dandanplayEnabled: true, dandanplayAppId: "private-app-id", dandanplayAppSecret: "private-app-secret", sourceEnabled: true }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function setup() {
  const hooks = createHooks<NitroRuntimeHooks>();
  await plugin({ hooks } as NitroApp);
  const app = createApp({
    onRequest: (event) => hooks.callHook("request", event),
    onError: (error, event) => hooks.callHook("error", error, { event, tags: ["request"] }),
    onAfterResponse: (event, response) => hooks.callHook("afterResponse", event, response),
  });
  const router = createRouter();
  app.use(router);
  return { hooks, router, fetch: toWebHandler(app) };
}

describe("server log privacy and lifecycle", () => {
  it("shows configuration state without exposing credentials or claiming upstream authentication", async () => {
    await setup();
    const output = JSON.stringify(logger.box.mock.calls);
    expect(output).toContain("🐍 Mamba-Animation");
    expect(output).toContain("auth not checked");
    expect(output).not.toContain("private-app-id");
    expect(output).not.toContain("private-app-secret");
  });

  it("logs response counts and route patterns without query, body, cookie or header contents", async () => {
    const { router, fetch } = await setup();
    const body = { data: [{ content: "private-comment", user: "private-user" }], total: 1 };
    router.get("/api/subjects/:id/comments", eventHandler(() => body));
    const response = await fetch(new Request("http://localhost/api/subjects/private-id/comments?q=private-query", { headers: { Authorization: "Bearer private-token", Cookie: "session=private-cookie" } }));
    expect(await response.json()).toEqual(body);
    expect(logger.info).toHaveBeenCalledTimes(1);
    const output = JSON.stringify(logger.info.mock.calls);
    expect(output).toContain("/api/subjects/:id/comments");
    expect(output).toContain("200");
    expect(output).toContain("1 条评论");
    for (const value of ["private-id", "private-query", "private-comment", "private-user", "private-token", "private-cookie"]) {
      expect(output).not.toContain(value);
    }
  });

  it("uses warning and error levels for actual failed responses without raw errors", async () => {
    const { router, fetch } = await setup();
    router.get("/api/danmaku/search", eventHandler(() => { throw createError({ statusCode: 400, message: "private-error" }); }));
    router.get("/api/danmaku/:id", eventHandler(() => { throw createError({ statusCode: 503, message: "private-upstream-url" }); }));
    expect((await fetch(new Request("http://localhost/api/danmaku/search"))).status).toBe(400);
    expect((await fetch(new Request("http://localhost/api/danmaku/123"))).status).toBe(503);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.warn.mock.calls)).toContain("400");
    expect(JSON.stringify(logger.error.mock.calls)).toContain("503");
    expect(JSON.stringify([logger.warn.mock.calls, logger.error.mock.calls])).not.toContain("private-");
  });

  it("marks slow successful API requests without changing their response", async () => {
    const { router, fetch } = await setup();
    const clock = vi.spyOn(performance, "now");
    clock.mockReturnValueOnce(100).mockReturnValueOnce(3300);
    router.get("/api/danmaku/:id", eventHandler(() => ({ items: [{ text: "private-text" }] })));
    expect((await fetch(new Request("http://localhost/api/danmaku/123"))).status).toBe(200);
    const output = JSON.stringify(logger.warn.mock.calls);
    expect(output).toContain("🐢");
    expect(output).toContain("3200 ms");
    expect(output).toContain("1 条弹幕");
    expect(output).not.toContain("private-text");
  });

  it("keeps successful health checks and static requests quiet, and reports shutdown and background failures safely", async () => {
    const { hooks, router, fetch } = await setup();
    router.get("/api/health", eventHandler(() => ({ status: "ok" })));
    router.get("/favicon.svg", eventHandler(() => "svg"));
    await fetch(new Request("http://localhost/api/health"));
    await fetch(new Request("http://localhost/favicon.svg"));
    expect(logger.info).not.toHaveBeenCalled();
    await hooks.callHook("error", new Error("private-background-secret"), {});
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain("private-background-secret");
    await hooks.callHook("close");
    expect(logger.info).toHaveBeenCalledWith("👋 服务已停止 · 下次放映见");
  });
});
