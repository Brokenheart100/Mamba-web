export const categoryRegions = ["全部", "日本动画", "国产动画", "欧美动画"] as const;
export const categoryRegionTags = {
  全部: "", 日本动画: "日本", 国产动画: "中国", 欧美动画: "欧美",
} as const;
export const categoryFormats = ["全部", "TV", "剧场版", "OVA", "WEB"] as const;
export const categoryGenres = ["全部", "奇幻", "热血", "搞笑", "恋爱", "校园", "异世界", "战斗", "冒险", "治愈", "科幻", "悬疑", "日常", "音乐", "运动", "百合"] as const;
export const categorySorts = [
  { label: "按热度", value: "heat" },
  { label: "按评分", value: "score" },
  { label: "按排名", value: "rank" },
];
export const categoryPageSize = 20;
export const categoryMaxResults = 1000;
