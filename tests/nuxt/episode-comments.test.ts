import { createError, getQuery } from "h3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { useRouter } from "#imports";
import EpisodeComments from "../../app/components/EpisodeComments.vue";

let mode: "results" | "empty" | "error" = "results";
const user = { name: "观众", avatar: "", url: "https://bgm.tv/user/123" };
const queries: Record<string, unknown>[] = [];
for (const id of [1227087, 1227088]) {
  registerEndpoint(`/api/episodes/${id}/comments`, (event) => {
    const query = getQuery(event);
    queries.push({ id, ...query });
    if (mode === "error") throw createError({ statusCode: 503, message: "模拟章节讨论故障" });
    return {
      data: mode === "empty" ? [] : [{
        id: Number(query.page), episodeId: id, content: `${id === 1227087 ? '第一集' : '第二集'}第 ${query.page} 页评论`, relatedId: 0, createdAt: 1_792_158_737, user,
        replies: [{ id: 999, episodeId: id, relatedId: Number(query.page), createdAt: 1_792_158_737, user, content: "回复原文 <img src=x onerror=alert(1)>" }],
      }],
      total: mode === "empty" ? 0 : 41, offset: (Number(query.page) - 1) * 20, limit: 20,
    };
  });
}
beforeEach(() => { mode = "results"; queries.length = 0; });

describe("episode discussions", () => {
  it("uses Nuxt UI to expand replies and renders their content as plain text", async () => {
    const wrapper = await mountSuspended(EpisodeComments, { props: { episodeId: 1227087, episodeTitle: "第 1 话 · 冒险结束" }, route: "/watch/400602/1227087" });
    try {
      await vi.waitFor(() => expect(wrapper.text()).toContain("第一集第 1 页评论"));
      expect(wrapper.text()).not.toContain("回复原文");
      await wrapper.findAll("button").find((button) => button.text().includes("展开 1 条回复"))!.trigger("click");
      await vi.waitFor(() => expect(wrapper.text()).toContain("回复原文 <img src=x onerror=alert(1)>"));
      expect(wrapper.find("p img").exists()).toBe(false);
      expect(wrapper.find('a[href="https://bgm.tv/ep/1227087"]').attributes("target")).toBe("_blank");
      expect(wrapper.find('a[href="https://bgm.tv/user/123"]').exists()).toBe(true);
    } finally { wrapper.unmount(); }
  });

  it("changes only the comments page query and preserves other playback query state", async () => {
    const wrapper = await mountSuspended(EpisodeComments, { props: { episodeId: 1227087 }, route: "/watch/400602/1227087?episodeCommentsPage=2&keep=value" });
    try {
      await vi.waitFor(() => expect(wrapper.text()).toContain("第一集第 2 页评论"));
      await wrapper.find('nav[aria-label="本集讨论分页"] a[href*="episodeCommentsPage=3"]').trigger("click");
      await vi.waitFor(() => expect(useRouter().currentRoute.value.query).toMatchObject({ episodeCommentsPage: "3", keep: "value" }));
      await vi.waitFor(() => expect(wrapper.text()).toContain("第一集第 3 页评论"));
      expect(queries.at(-1)).toEqual({ id: 1227087, page: "3" });
      expect(useRouter().currentRoute.value.path).toBe("/watch/400602/1227087");
    } finally { wrapper.unmount(); }
  });

  it("loads the new episode rather than retaining the previous episode's discussion", async () => {
    const wrapper = await mountSuspended(EpisodeComments, { props: { episodeId: 1227087 }, route: "/watch/400602/1227087?episodeCommentsPage=2" });
    try {
      await vi.waitFor(() => expect(wrapper.text()).toContain("第一集第 2 页评论"));
      await useRouter().push("/watch/400602/1227088");
      await wrapper.setProps({ episodeId: 1227088 });
      await vi.waitFor(() => expect(wrapper.text()).toContain("第二集第 1 页评论"));
      expect(wrapper.text()).not.toContain("第一集");
      expect(queries.at(-1)).toEqual({ id: 1227088, page: "1" });
    } finally { wrapper.unmount(); }
  });

  it("keeps the original page link available on failure and supports retry", async () => {
    mode = "error";
    const wrapper = await mountSuspended(EpisodeComments, { props: { episodeId: 1227087 }, route: "/watch/400602/1227087" });
    try {
      await vi.waitFor(() => expect(wrapper.text()).toContain("本集讨论暂时无法加载"));
      expect(wrapper.find('a[href="https://bgm.tv/ep/1227087"]').exists()).toBe(true);
      mode = "results";
      await wrapper.findAll("button").find((button) => button.text().includes("重新加载"))!.trigger("click");
      await vi.waitFor(() => expect(wrapper.text()).toContain("第一集第 1 页评论"));
    } finally { wrapper.unmount(); }
  });

  it("shows empty and invalid-page states with a usable return to the first page", async () => {
    mode = "empty";
    const wrapper = await mountSuspended(EpisodeComments, { props: { episodeId: 1227087 }, route: "/watch/400602/1227087?episodeCommentsPage=99" });
    try {
      await vi.waitFor(() => expect(wrapper.text()).toContain("这一页暂时没有评论"));
      expect(wrapper.find('a[href="/watch/400602/1227087?episodeCommentsPage=1#episode-comments"]').text()).toBe("返回评论首页");
      await useRouter().push("/watch/400602/1227087?episodeCommentsPage=bad");
      await vi.waitFor(() => expect(wrapper.text()).toContain("评论页码无效，已显示第 1 页"));
      await vi.waitFor(() => expect(wrapper.text()).toContain("本集还没有讨论"));
    } finally { wrapper.unmount(); }
  });
});
