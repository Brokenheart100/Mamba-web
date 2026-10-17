# Bangumi 内容发现

本次新增季度新番、动画榜单，以及详情页关联作品、角色与声优。依据 [Bangumi 官方 OpenAPI](https://github.com/bangumi/api/blob/master/open-api/v0.yaml)，复用现有元数据 provider、SubjectCard、AnimeCover、GlassCard 和反馈组件。

## 页面与上游

| 页面能力 | 本项目接口 | Bangumi 官方接口 |
| --- | --- | --- |
| 季度新番 `/seasons` | `GET /api/subjects/browse?mode=season` | `POST /v0/search/subjects` |
| 动画榜单 `/rankings` | `GET /api/subjects/browse?mode=ranking` | `GET /v0/subjects?type=2&sort=rank` |
| 关联作品 | `GET /api/subjects/:id/related` | `GET /v0/subjects/{subject_id}/subjects` |
| 角色与声优 | `GET /api/subjects/:id/characters` | `GET /v0/subjects/{subject_id}/characters` |

季度按完整三个月查询：冬季 1—3 月、春季 4—6 月、夏季 7—9 月、秋季 10—12 月。查询使用包含起点、不包含下一季度起点的 `air_date` 范围；例如 2024 秋季为 `>=2024-10-01` 与 `<2025-01-01`。默认季度按上海时区计算，避免服务端 UTC 时区导致跨季错位。

榜单使用上游的排名顺序；卡片徽标显示作品的全站排名，筛选年份后不会重新编号。每页 20 部，提供前 1000 个结果的分页；年份可缩小范围。筛选和页码写入 URL，切换筛选会回到第 1 页。

关联动画进入站内详情；书籍、音乐、游戏等进入 Bangumi 页面。角色与声优链接至 Bangumi 官方人物页，并以新标签页打开。上游关联响应未提供评分、集数等完整条目字段，关联卡片只显示已有资料和关联类型，不逐个请求条目详情。角色响应自带声优，直接使用，避免额外请求。

## 复用与加载

- 筛选、分页、标签切换、角色轮播分别使用 Nuxt UI 的 USelect、UPagination、UTabs、UCarousel；轮播由其内置 Embla 提供，无自制拖动逻辑。
- Nuxt useFetch 管理请求状态；Nitro defineCachedFunction 缓存列表 15 分钟、关联作品与角色 1 小时，启用 SWR。缓存可能暂时显示旧数据。
- H3 validated query 与 Zod 处理查询入口；关联作品与角色响应也用 Zod 校验，缺失图片和声优有空值回退。
- 详情页扩展资料在客户端独立加载，不阻塞原有详情与章节；两个扩展区各有错误提示和重试按钮。图片复用 Nuxt Image，角色立绘使用 contain，避免封面裁剪截掉头部。
- 不引入登录、服务端观看记录或额外状态管理依赖。

## 本地验证（2026-10-16）

自动化测试与真实服务验证分开记录：

- 自动化：15 个测试文件、98 项测试通过。新增覆盖完整季度边界、上海时区跨年、榜单年份与分页、非法查询、关联类型映射、角色空值、资料错误隔离、站内外链接和 URL 恢复。
- 检查：ESLint、Nuxt 类型检查与生产构建通过。构建存在依赖的弃用、打包注释与既有 BigInt 目标告警，未阻断构建。
- 真实 Bangumi 经本地生产 BFF：2024 秋季返回总数 276、每页 20；2024 年榜单返回总数 391，第二页首项全站排名 928；条目 400602 返回 21 个关联作品和 91 个角色。数值随上游更新。
- 非法季度、超出第 50 页、非数字条目 ID 均返回 400。
- Edge 生产页面验证：季度切换重置页码、列表分页、角色轮播、3 个动画站内链接与 18 个非动画站外链接；手机 390×844 无横向溢出，控制台无错误。侧栏增加滚动以适应新增菜单和较矮窗口。
- 截图留在被 Git 忽略的 `output/playwright/discovery-*.png`。

以上证明本地接口与页面可用，不代表全部条目都拥有完整资料，也不代表视频源可播放或已经部署上线。
