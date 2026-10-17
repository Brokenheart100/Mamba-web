import { createError, getQuery } from "h3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { useRouter } from "#imports";
import SubjectComments from "../../app/components/SubjectComments.vue";

let mode: "results" | "empty" | "error" = "results";
const queries: Record<string, unknown>[] = [];
registerEndpoint("/api/subjects/400602/comments", (event) => {
  const query = getQuery(event);
  queries.push(query);
  if (mode === "error") throw createError({ statusCode: 503, message: "模拟评论故障" });
  return {
    data: mode === "empty" ? [] : [{ id: Number(query.page), content: `第 ${query.page} 页短评\n<img src=x onerror=alert(1)>`, rating: 0, status: "看过", updatedAt: 1_792_158_737, user: { name: "观众", avatar: "", url: "https://bgm.tv/user/123" } }],
    total: mode === "empty" ? 0 : 41, offset: (Number(query.page) - 1) * 20, limit: 20,
  };
});
beforeEach(() => { mode = "results"; queries.length = 0; });

describe("subject comments UI", () => {
  it("renders comments as plain text and restores URL pagination without losing unrelated query state", async () => {
    const wrapper = await mountSuspended(SubjectComments, { props: { subjectId: 400602 }, route: "/subject/400602?commentsPage=2&keep=value" });
    try {
      await vi.waitFor(() => expect(wrapper.text()).toContain("第 2 页短评"));
      expect(wrapper.text()).toContain("<img src=x onerror=alert(1)>");
      expect(wrapper.find("p img").exists()).toBe(false);
      expect(wrapper.text()).not.toContain("0 / 10");
      expect(wrapper.find('a[href="https://bgm.tv/user/123"]').attributes("rel")).toContain("noopener");
      await wrapper.find('nav[aria-label="评论分页"] a[href*="commentsPage=3"]').trigger("click");
      await vi.waitFor(() => expect(useRouter().currentRoute.value.query).toMatchObject({ commentsPage: "3", keep: "value" }));
      await vi.waitFor(() => expect(queries.at(-1)).toEqual({ page: "3" }));
      await vi.waitFor(() => expect(wrapper.text()).toContain("第 3 页短评"));
    } finally { wrapper.unmount(); }
  });

  it("keeps the official fallback link available when the service fails and can retry", async () => {
    mode = "error";
    const wrapper = await mountSuspended(SubjectComments, { props: { subjectId: 400602 }, route: "/subject/400602?commentsPage=2" });
    try {
      await vi.waitFor(() => expect(wrapper.text()).toContain("评论暂时无法加载"));
      expect(wrapper.find('a[href="https://bgm.tv/subject/400602/comments"]').exists()).toBe(true);
      mode = "results";
      await wrapper.findAll("button").find((button) => button.text().includes("重新加载"))!.trigger("click");
      await vi.waitFor(() => expect(wrapper.text()).toContain("第 2 页短评"));
    } finally { wrapper.unmount(); }
  });

  it("offers a return to page one when a stale URL points to an empty page", async () => {
    mode = "empty";
    const wrapper = await mountSuspended(SubjectComments, { props: { subjectId: 400602 }, route: "/subject/400602?commentsPage=99" });
    try {
      await vi.waitFor(() => expect(wrapper.text()).toContain("这一页暂时没有评论"));
      expect(wrapper.find('a[href="/subject/400602?commentsPage=1#comments"]').text()).toBe("返回评论首页");
    } finally { wrapper.unmount(); }
  });

  it("falls back to the first page for malformed comment page links", async () => {
    const wrapper = await mountSuspended(SubjectComments, { props: { subjectId: 400602 }, route: "/subject/400602?commentsPage=bad" });
    try {
      await vi.waitFor(() => expect(wrapper.text()).toContain("第 1 页短评"));
      expect(wrapper.text()).toContain("评论页码无效，已显示第 1 页");
      expect(queries.at(-1)).toEqual({ page: "1" });
    } finally { wrapper.unmount(); }
  });
});
