import { describe, expect, it } from "vitest";
import { toPlayerDanmaku } from "../app/player/danmaku-adapter";
import { defaultSettings, normalizeSettings } from "../shared/utils/media";
import type { Danmaku } from "../shared/types/media";

const row = (overrides: Partial<Danmaku> = {}): Danmaku => ({
  id: "1",
  time: 5,
  text: "<b>纯文本</b>",
  color: "#ffffff",
  mode: "scroll",
  ...overrides,
});
describe("ArtPlayer danmaku adapter", () => {
  it("keeps display modes, colors and text without sharing mutable source objects", () => {
    const source = [row(), row({ mode: "top" }), row({ mode: "bottom" })];
    const items = toPlayerDanmaku(source, 0);
    expect(items.map((item) => item.mode)).toEqual([0, 1, 2]);
    expect(items[0]).toMatchObject({
      text: "<b>纯文本</b>",
      color: "#ffffff",
      time: 5,
    });
    items[0]!.text = "plugin mutation";
    expect(source[0]!.text).toBe("<b>纯文本</b>");
  });
  it("delays positive offsets and drops comments shifted before the start", () => {
    expect(toPlayerDanmaku([row()], 3)[0]?.time).toBe(8);
    expect(toPlayerDanmaku([row()], -6)).toEqual([]);
    expect(toPlayerDanmaku([row()], -2)[0]?.time).toBe(3);
  });
  it("preserves a zero timestamp rather than triggering the plugin immediate-emission path", () => {
    expect(toPlayerDanmaku([row({ time: 0 })], 0)[0]?.time).toBe(0.001);
  });
});
describe("backward compatible player preferences", () => {
  it("retains legacy preferences while supplying new danmaku defaults", () => {
    const settings = normalizeSettings({
      volume: 0,
      rate: 1.5,
      danmaku: false,
      danmakuOpacity: 0.45,
      danmakuOffset: -3,
    });
    expect(settings).toMatchObject({
      volume: 0,
      rate: 1.5,
      danmaku: false,
      danmakuOpacity: 0.45,
      danmakuOffset: -3,
      danmakuFontSize: 24,
      danmakuArea: 0.75,
      danmakuAntiOverlap: true,
    });
  });
  it("bounds new plugin settings and rejects unknown display modes", () => {
    expect(
      normalizeSettings({
        danmakuFontSize: 100,
        danmakuSpeed: -5,
        danmakuArea: 99,
        danmakuOpacity: 0,
        danmakuOffset: Infinity,
        danmakuModes: ["top", "top", "invalid" as never],
      }),
    ).toMatchObject({
      danmakuFontSize: 36,
      danmakuSpeed: 1,
      danmakuArea: 1,
      danmakuOpacity: 0,
      danmakuOffset: 0,
      danmakuModes: ["top"],
    });
  });
  it("does not share default mode arrays or override an intentionally empty selection", () => {
    const settings = normalizeSettings();
    settings.danmakuModes.length = 0;
    expect(defaultSettings.danmakuModes).toEqual(["scroll", "top", "bottom"]);
    expect(normalizeSettings({ danmakuModes: [] }).danmakuModes).toEqual([]);
  });
});
