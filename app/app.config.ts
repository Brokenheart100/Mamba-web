export default defineAppConfig({
  ui: {
    colors: { primary: "blue", secondary: "violet", neutral: "zinc" },
    button: {
      slots: { base: "rounded-full font-medium cursor-pointer" },
      defaultVariants: { size: "md" },
    },
    input: { slots: { base: "rounded-2xl", root: "min-w-0" } },
    select: {
      slots: { base: "rounded-2xl", content: "rounded-2xl backdrop-blur-xl" },
    },
    tabs: {
      slots: {
        list: "rounded-full",
        indicator: "rounded-full",
        trigger: "rounded-full",
      },
    },
    switch: { defaultVariants: { color: "success" } },
    navigationMenu: {
      slots: {
        link: "rounded-2xl gap-3 py-3 px-4 before:rounded-2xl",
        linkLeadingIcon: "size-5",
        list: "space-y-1.5",
      },
    },
    modal: {
      slots: { content: "rounded-[28px]", overlay: "backdrop-blur-sm" },
    },
  },
});
