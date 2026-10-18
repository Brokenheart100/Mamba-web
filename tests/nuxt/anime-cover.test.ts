import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { nextTick } from "vue";
import { useImage } from "#imports";
import vercelProvider from "@nuxt/image/runtime/providers/vercel";
import AnimeCover from "../../app/components/AnimeCover.vue";

describe("Nuxt Image cover", () => {
  it("uses the platform default when only Vercel and direct providers are registered", async () => {
    const image = useImage();
    const previousProvider = image.options.provider;
    const previousProviders = image.options.providers;
    // Simulate a cloud registry instead of the locally generated IPX registry.
    Object.assign(image.options, {
      provider: "vercel",
      providers: {
        none: previousProviders.none!,
        vercel: { setup: vercelProvider, defaults: {} },
      },
    });
    try {
      const wrapper = await mountSuspended(AnimeCover, {
        props: { src: "https://lain.bgm.tv/pic/cover/l/test.jpg", alt: "云端封面" },
      });
      try {
        expect(wrapper.get("img").attributes("src")).toContain("lain.bgm.tv");
        expect(wrapper.get("img").attributes("src")).not.toContain("/_ipx/");
      } finally {
        wrapper.unmount();
      }
    } finally {
      image.options.provider = previousProvider;
      image.options.providers = previousProviders;
    }
  });

  it("generates responsive optimized CDN URLs and keeps accessible image attributes", async () => {
    const wrapper = await mountSuspended(AnimeCover, {
      props: {
        src: "https://lain.bgm.tv/pic/cover/l/test.jpg",
        alt: "番剧封面",
        sizes: "150px sm:220px",
      },
    });
    try {
      const img = wrapper.get("img");
      expect(img.attributes("src")).toContain("/_ipx/");
      expect(img.attributes("srcset")).toContain("lain.bgm.tv");
      expect(img.attributes("sizes")).toBeTruthy();
      expect(img.attributes()).toMatchObject({
        alt: "番剧封面",
        loading: "lazy",
        decoding: "async",
        width: "300",
        height: "428",
      });
    } finally {
      wrapper.unmount();
    }
  });

  it("falls back on image failure and retries when the subject changes", async () => {
    const wrapper = await mountSuspended(AnimeCover, {
      props: { src: "https://lain.bgm.tv/pic/cover/l/old.jpg", alt: "封面" },
    });
    try {
      await wrapper.get("img").trigger("error");
      await nextTick();
      expect(wrapper.get("img").attributes("src")).toBe(
        "/poster-placeholder.svg",
      );
      await wrapper.setProps({
        src: "https://lain.bgm.tv/pic/cover/l/new.jpg",
      });
      expect(wrapper.get("img").attributes("src")).toContain("new.jpg");
    } finally {
      wrapper.unmount();
    }
  });

  it("does not proxy imported external covers and rejects non-HTTP URLs", async () => {
    const wrapper = await mountSuspended(AnimeCover, {
      props: { src: "https://example.org/my-cover.jpg", alt: "自定义封面" },
    });
    try {
      expect(wrapper.get("img").attributes("src")).toBe(
        "https://example.org/my-cover.jpg",
      );
      await wrapper.setProps({ src: "javascript:alert(1)" });
      expect(wrapper.get("img").attributes("src")).toBe(
        "/poster-placeholder.svg",
      );
    } finally {
      wrapper.unmount();
    }
  });
});
