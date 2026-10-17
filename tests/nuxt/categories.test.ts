import { createError, getQuery } from "h3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { useRouter } from "#imports";
import Categories from "../../app/pages/categories.vue";
import type { Subject } from "../../shared/types/media";

const fixture: Subject = {
  id: 400602, name: "分类联调动画", originalName: "测试", image: "", summary: "",
  score: 8, ratingCount: 10, rank: 1, date: "2024-01-01", platform: "TV", episodes: 12, tags: ["科幻"],
};
const queries: Record<string, unknown>[] = [];
let mode: "results" | "empty" | "error" = "results";
registerEndpoint("/api/subjects/categories", (event) => {
  queries.push(getQuery(event));
  if (mode === "error") throw createError({ statusCode: 503, message: "测试服务不可用" });
  return { data: mode === "empty" ? [] : [fixture], total: mode === "empty" ? 0 : 73, offset: 0, limit: 20 };
});
beforeEach(() => { mode = "results"; });
afterEach(() => { queries.length = 0; });

describe("anime classification page", () => {
  it("shows an empty result without discarding selected filters", async () => {
    mode = "empty";
    const wrapper = await mountSuspended(Categories, { route: "/categories?genre=冒险&year=2025" });
    try {
      expect(wrapper.text()).toContain("这个组合，还没找到故事");
      expect(wrapper.text()).toContain("冒险");
      expect(wrapper.find('nav[aria-label="动漫分类分页"]').exists()).toBe(false);
    } finally { wrapper.unmount(); }
  });

  it("can retry a failed query with its filters intact", async () => {
    mode = "error";
    const wrapper = await mountSuspended(Categories, { route: "/categories?genre=音乐&year=2020" });
    try {
      expect(wrapper.text()).toContain("分类暂时无法加载");
      mode = "results";
      await wrapper.findAll("button").find((button) => button.text().includes("重新加载"))!.trigger("click");
      await vi.waitFor(() => expect(wrapper.text()).toContain("分类联调动画"));
      expect(queries.at(-1)).toMatchObject({ genre: "音乐", year: "2020" });
    } finally { wrapper.unmount(); }
  });
  it("restores URL filters and pagination, resets the page on selection, and supports browser back", async () => {
    const router = useRouter();
    const wrapper = await mountSuspended(Categories, { route: "/categories?genre=科幻&year=2024&page=2" });
    try {
      expect(wrapper.text()).toContain("分类联调动画");
      expect(wrapper.find('[role="radio"][value="科幻"]').attributes("data-state")).toBe("checked");
      expect(queries.at(-1)).toMatchObject({ genre: "科幻", year: "2024", page: "2" });
      await wrapper.findAll('button').find((button) => button.attributes('aria-label') === '移除科幻筛选')!.trigger('click');
      await vi.waitFor(() => expect(router.currentRoute.value.query).toMatchObject({ genre: "全部", year: "2024", page: "1" }));
      await vi.waitFor(() => expect(queries.at(-1)).toMatchObject({ genre: "全部", page: "1" }));
      router.back();
      await vi.waitFor(() => expect(router.currentRoute.value.query).toMatchObject({ genre: "科幻", page: "2" }));
    } finally {
      wrapper.unmount();
    }
  });
});
