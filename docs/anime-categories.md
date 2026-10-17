# 动漫分类页面

入口为 `/categories`，侧栏“动漫分类”可访问。保留现有 iOS 玻璃风格。

## 复用现有能力

- 筛选使用 Nuxt UI `URadioGroup`，手机年份使用 `USelect`；分页使用 `UPagination`，选中条件使用 `UButton`，加载占位使用 `USkeleton`。
- 复用现有 `GlassCard`、`SubjectCard`、`AnimeCover` 和 `FeedbackState`；未另写筛选控件、分页器或卡片组件，未增加依赖。
- 使用 Nuxt `useFetch` 获取数据、Vue Router 维护网址状态，筛选变化自动回到第一页；浏览器刷新、返回和链接分享可恢复筛选。
- 后端复用 Bangumi `$fetch` 请求封装及 Nitro 缓存（五分钟 / SWR），入口参数使用 Zod。筛选配置放在 `shared/constants/categories.ts`。

## 筛选与数据来源

`GET /api/subjects/categories` 接收 `region`、`format`、`genre`、`year`、`sort`、`page`，转换为官方 `POST /v0/search/subjects`：

- 固定动画类型 `filter.type: [2]`，关键词为空。
- 地区映射为 `日本`、`中国`、`欧美` 标签；形式与题材也使用标签。多个标签按官方规则取交集。
- 年份转换为 `>=YYYY-01-01` 和 `<下一年-01-01`；2000 年以前使用 `<2000-01-01`。
- 排序只使用官方支持的 `heat`、`score`、`rank`，分别显示为热度、评分、排名。
- 筛选在上游目录查询中完成，不从当前页或已下载的少量条目中做客户端过滤。地区标签不等同于经过验证的制作国，页面注明标签可能不完整。
- 当前实际接口每页返回最多 20 条，搜索结果最多可浏览 1000 项，页码范围 1～50。普通搜索页也同步改为每页 20 条，避免原先请求 24 条但只返回 20 条导致的分页漏项。

官方组合搜索没有首字母条件或按日期排序，因此没有仿造截图中的首字母和“最新”选项。单独浏览 API 的日期排序不能直接与本页所有标签条件组合，本轮不混用两种含义不同的数据。

## 验证（2026-10-16）

- ESLint、类型检查、生产构建通过；14 个测试文件、85 项测试通过。新增覆盖筛选映射、年份边界、分页步长、非法参数、网址恢复、筛选重置页码、返回恢复、空结果和错误重试。
- 实际生产 API：“国产动画＋奇幻＋2024”返回 73 项；第一页 20 条、第二页 20 条、第四页 13 条，前两页无重复，第一页面向用户返回的放送日期均在 2024 年。
- 无结果组合返回 200 / 空数组；非法排序与重复标签参数返回 400。
- 独立 Edge 会话验证标签点击、真实列表分页及手机布局。开发服务热更新期间曾出现 Vue scheduler 异常；新的生产会话中没有复现，生产页面控制台零错误、零警告。
- 日志与截图保存于忽略的 `output/categories-*.log`、`output/categories-live.json`、`output/playwright/categories-*.png`。

官方依据：[Bangumi OpenAPI v0](https://github.com/bangumi/api/blob/master/open-api/v0.yaml)。该搜索接口标记为实验性，参数含义以官方实际服务和文档为准。
