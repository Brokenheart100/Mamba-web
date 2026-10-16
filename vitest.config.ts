import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { defineVitestProject } from "@nuxt/test-utils/config";

const packageFile = (path: string) =>
  fileURLToPath(new URL(`./node_modules/${path}`, import.meta.url)).replaceAll(
    "\\",
    "/",
  );
const nuxtProject = await defineVitestProject({
  plugins: [
    {
      name: "test-physical-nuxt-entry",
      enforce: "pre",
      transform(code, id) {
        // Keep the official test root with a physical entry: Vitest 5 loses the
        // Windows drive letter for the non-existent virtual entry file.
        if (id.endsWith("/nuxt/dist/app/entry.js")) {
          return code.replace(
            "#build/root-component.mjs",
            packageFile("@nuxt/test-utils/dist/runtime/nuxt-root.mjs"),
          );
        }
      },
    },
  ],
  test: {
    name: "nuxt",
    include: ["tests/nuxt/**/*.test.ts"],
    environment: "nuxt",
    setupFiles: ["./tests/nuxt/setup.ts"],
    hookTimeout: 30000,
    environmentOptions: {
      nuxt: {
        domEnvironment: "happy-dom",
        mock: { indexedDb: true },
        overrides: {
          buildDir: fileURLToPath(new URL("./.nuxt/test", import.meta.url)),
        },
      },
    },
    restoreMocks: true,
  },
});
// The exact entry alias must precede Nuxt's broader #app prefix alias.
const aliases = nuxtProject.resolve?.alias || {};
nuxtProject.resolve = {
  ...nuxtProject.resolve,
  alias: [
    {
      find: /^#app\/nuxt-vitest-app-entry$/,
      replacement: packageFile("nuxt/dist/app/entry.js"),
    },
    ...(Array.isArray(aliases)
      ? aliases
      : Object.entries(aliases).map(([find, replacement]) => ({
          find,
          replacement,
        }))),
  ],
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: {
            "#shared": fileURLToPath(new URL("./shared", import.meta.url)),
          },
        },
        test: {
          name: "unit",
          include: ["tests/*.test.ts"],
          environment: "node",
          clearMocks: true,
        },
      },
      nuxtProject,
    ],
  },
});
