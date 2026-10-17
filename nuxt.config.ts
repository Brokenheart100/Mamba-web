export default defineNuxtConfig({
  compatibilityDate: "2026-10-15",
  devtools: { enabled: false },
  modules: ["@nuxt/ui", "@nuxt/image", "@pinia/nuxt", "@vueuse/nuxt/module", "@nuxt/eslint"],
  ui: { fonts: false },
  image: {
    domains: ["lain.bgm.tv"],
    providers: { none: { provider: "none" } },
  },
  colorMode: { preference: "light", fallback: "light" },
  icon: { mode: "svg", serverBundle: { collections: ["lucide"] } },
  css: ["~/assets/main.css", "~/assets/player.css"],
  app: {
    head: {
      htmlAttrs: { lang: "zh-CN" },
      title: "Mamba-Animation — 你的动漫放映室",
      meta: [
        {
          name: "description",
          content:
            "发现好动画，打开即看。无需登录，观看进度只保存在你的浏览器。",
        },
      ],
      link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    },
  },
  nitro: { preset: "node-server" },
  vite: { optimizeDeps: { include: ["hls.js", "idb"] } },
  routeRules: {
    "/watch/**": { ssr: false },
    "/history": { ssr: false },
    "/settings": { ssr: false },
    "/player-lab": { ssr: false },
  },
  runtimeConfig: {
    sourceEnabled: true,
    playbackSecret: "",
    dandanplayEnabled: true,
    dandanplayAppId: "",
    dandanplayAppSecret: "",
    dandanplayCdnHosts: "",
    public: {},
  },
});
