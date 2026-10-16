import { describe, expect, it } from "vitest";
import { validateDanmaku } from "../shared/utils/danmaku";
describe("danmaku imports", () => {
  it("sorts comments and keeps markup as plain text", () => {
    const rows = validateDanmaku([
      { time: 10, text: "<img src=x onerror=alert(1)>", color: "red" },
      { time: 2, text: "好看", mode: "top", color: "#ff0000" },
    ]);
    expect(rows[0]).toMatchObject({ time: 2, mode: "top", color: "#ff0000" });
    expect(rows[1]).toMatchObject({
      text: "<img src=x onerror=alert(1)>",
      color: "#ffffff",
      mode: "scroll",
    });
  });
  it("rejects invalid timestamps and oversized comments", () => {
    expect(() => validateDanmaku([{ time: -1, text: "x" }])).toThrow();
    expect(() =>
      validateDanmaku([{ time: 1, text: "x".repeat(301) }]),
    ).toThrow();
  });
});
