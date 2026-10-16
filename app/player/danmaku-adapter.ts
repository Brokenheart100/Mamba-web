import type { Danmu, Mode } from "artplayer-plugin-danmuku";
import type { Danmaku } from "#shared/types/media";

export const danmakuMode: Record<Danmaku["mode"], Mode> = {
  scroll: 0,
  top: 1,
  bottom: 2,
};

export function toPlayerDanmaku(
  items: readonly Danmaku[],
  offset: number,
): Danmu[] {
  return items.flatMap((item) => {
    const time = item.time + offset;
    if (!Number.isFinite(time) || time < 0) return [];
    // The plugin treats time:0 as an immediately emitted comment. Preserve timestamp zero.
    return [
      {
        text: item.text,
        time: Math.max(0.001, time),
        color: item.color,
        mode: danmakuMode[item.mode],
      },
    ];
  });
}
