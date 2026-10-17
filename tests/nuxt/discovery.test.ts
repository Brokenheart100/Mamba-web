import { createError, getQuery } from "h3";
import { describe, expect, it, vi } from "vitest";
import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { useRouter } from "#imports";
import AnimeBrowse from "../../app/components/AnimeBrowse.vue";
import SubjectExtras from "../../app/components/SubjectExtras.vue";
import type { Subject } from "../../shared/types/media";

const fixture: Subject = { id: 400602, name: "季度动画", originalName: "测试", image: "", summary: "", score: 8, ratingCount: 10, rank: 17, date: "2024-11-01", platform: "TV", episodes: 12, tags: [] };
const queries: Record<string, unknown>[] = [];
registerEndpoint("/api/subjects/browse", (event) => {
  queries.push(getQuery(event));
  return { data: [fixture], total: 73, offset: 0, limit: 20 };
});
registerEndpoint("/api/subjects/400602/related", () => [
  { subject: { ...fixture, id: 1, name: "动画续集" }, type: 2, relation: "续集" },
  { subject: { ...fixture, id: 2, name: "漫画原作" }, type: 1, relation: "原作" },
]);
registerEndpoint("/api/subjects/400603/related", () => { throw createError({ statusCode: 503, message: "模拟故障" }); });
for (const id of [400602, 400603]) {
  registerEndpoint(`/api/subjects/${id}/characters`, () => [{ id: 86246, name: "芙莉莲", image: "", relation: "主角", actors: [{ id: 7575, name: "種﨑敦美", image: "" }] }]);
}

describe("Bangumi discovery UI", () => {
  it("restores quarter/page URLs and resets pagination when changing the year through Nuxt UI", async () => {
    const wrapper = await mountSuspended(AnimeBrowse, { props: { mode: "season" }, route: "/seasons?year=2024&quarter=4&page=2" });
    try {
      expect(wrapper.text()).toContain("季度动画");
      expect(queries.at(-1)).toMatchObject({ mode: "season", year: "2024", quarter: "4", page: "2" });
      const select = wrapper.findComponent({ name: "USelect" });
      select.vm.$emit("update:modelValue", "2023");
      await vi.waitFor(() => expect(useRouter().currentRoute.value.query).toMatchObject({ year: "2023", quarter: "4", page: "1" }));
      await vi.waitFor(() => expect(queries.at(-1)).toMatchObject({ year: "2023", page: "1" }));
    } finally { wrapper.unmount(); }
  });

  it("uses API ranks rather than list positions and forces ranking mode", async () => {
    const wrapper = await mountSuspended(AnimeBrowse, { props: { mode: "ranking" }, route: "/rankings?mode=season&year=2024&sort=heat" });
    try {
      expect(wrapper.text()).toContain("#17");
      expect(queries.at(-1)).toMatchObject({ mode: "ranking", year: "2024", sort: "rank" });
      expect(wrapper.find('[aria-label="季度"]').exists()).toBe(false);
    } finally { wrapper.unmount(); }
  });

  it("routes animation internally and books externally, with official character and actor links", async () => {
    const wrapper = await mountSuspended(SubjectExtras, { props: { subjectId: 400602 } });
    try {
      await vi.waitFor(() => expect(wrapper.text()).toContain("动画续集"));
      expect(wrapper.find('a[href="/subject/1"]').exists()).toBe(true);
      expect(wrapper.find('a[href="https://bgm.tv/subject/2"]').exists()).toBe(false);
      await wrapper.findAll('[role="tab"]').find((tab) => tab.text().includes("全部关联"))!.trigger("mousedown", { button: 0, ctrlKey: false });
      expect(wrapper.find('a[href="https://bgm.tv/subject/2"]').attributes("target")).toBe("_blank");
      expect(wrapper.find('a[href="https://bgm.tv/character/86246"]').exists()).toBe(true);
      expect(wrapper.find('a[href="https://bgm.tv/person/7575"]').text()).toBe("種﨑敦美");
    } finally { wrapper.unmount(); }
  });

  it("keeps characters visible when related works fail", async () => {
    const wrapper = await mountSuspended(SubjectExtras, { props: { subjectId: 400603 } });
    try {
      await vi.waitFor(() => expect(wrapper.text()).toContain("关联作品暂时无法加载"));
      await vi.waitFor(() => expect(wrapper.text()).toContain("芙莉莲"));
      expect(wrapper.text()).toContain("種﨑敦美");
    } finally { wrapper.unmount(); }
  });
});
