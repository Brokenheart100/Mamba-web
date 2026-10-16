import { beforeEach, describe, expect, it, vi } from "vitest";
import { signResource, verifyResource } from "../server/utils/resource-token";
beforeEach(() => {
  vi.stubGlobal("useRuntimeConfig", () => ({
    playbackSecret: "unit-test-signing-secret",
  }));
  vi.stubGlobal(
    "createError",
    (options: { message: string }) => new Error(options.message),
  );
});
const claim = {
  subjectId: 400602,
  episodeId: 1227087,
  path: "/watch/44/2/1.html",
  channel: "备用①",
};
describe("server resource boundary", () => {
  it("round-trips a registered resource", () => {
    expect(verifyResource(signResource(claim))).toMatchObject(claim);
  });
  it("rejects a tampered signature", () => {
    const token = signResource(claim);
    expect(() =>
      verifyResource(token.slice(0, -1) + (token.endsWith("a") ? "b" : "a")),
    ).toThrow("签名");
  });
  it("rejects arbitrary URLs even with a valid signature", () => {
    expect(() =>
      verifyResource(
        signResource({ ...claim, path: "https://127.0.0.1/admin" }),
      ),
    ).toThrow("格式");
  });
  it("rejects expired resources", () => {
    const now = Date.now();
    const token = signResource(claim);
    const spy = vi.spyOn(Date, "now").mockReturnValue(now + 3_700_000);
    expect(() => verifyResource(token)).toThrow("过期");
    spy.mockRestore();
  });
});
