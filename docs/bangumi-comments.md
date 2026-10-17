# Bangumi 评论接入

详情页的“大家怎么说”展示 Bangumi 吐槽箱短评；播放页的“本集讨论”展示当前章节的评论和楼中楼回复。保持无登录模式，只读展示；发表、修改、点赞等互动通过“前往 Bangumi”入口进行。不包含长篇日志或小组讨论帖。

## 官方接口依据

- [公开 v0 OpenAPI](https://github.com/bangumi/api/blob/master/open-api/v0.yaml) 没有条目短评列表路由。
- [官方新站 OpenAPI](https://github.com/bangumi/dev-docs/blob/master/api.json) 定义 `GET /p1/subjects/{subjectID}/comments`，支持 `limit`、`offset` 和可选的收藏类型；响应为 `{ data, total }`，每条包含 `user`、`comment`、`rate`、`type`、`updatedAt`。
- 根据[官方说明](https://github.com/bangumi/dev-docs#新网站和私有-api)，生产主机为 `next.bgm.tv`。这是为新站前端提供的私有 API，无兼容性保证，与 `api.bgm.tv/v0` 分开维护。
- 虽然 OpenAPI 标注了认证方案，本次实际未发送 Cookie 或 Authorization，匿名读取返回 200。匿名可用属于当前实测结果，不是未来保证；如以后返回 401/403，评论区提示暂不可读取并保留原页链接。

## 实现

浏览器请求 `GET /api/subjects/:id/comments?page=1`，Nitro 服务端转至固定的官方主机。每页 20 条；H3 与 Zod 校验条目 ID、页码和上游响应。页码最大 10000，站内最多可浏览前 200000 条；若超过，提示前往原页。`commentsPage` 保存在详情页 URL，翻页保留其他查询参数并定位到评论区，失效页码可返回第一页。

评论独立客户端加载，不阻塞详情、章节、关联作品或角色。Nuxt useFetch 管理加载和错误状态，Nitro defineCachedFunction 使用 5 分钟缓存及 SWR，短评更新可能有延迟。上游超时为 12 秒且不自动重试。异常只返回简明提示，不回传上游正文或用户资料中的无关字段。

页面复用 Nuxt UI 的 UAvatar、UBadge、UButton、USkeleton、UPagination，以及现有 GlassCard、FeedbackState。未新增依赖、登录、服务端记录或自制分页组件。评分 0 表示未评分，不展示为零分；时间按上海时区显示。评论纯文本保留换行，不执行 HTML 或 BBCode。头像限 Bangumi 图片主机，由 UAvatar 提供失败占位。

## 每集讨论（2026-10-17）

播放页通过 `GET /api/episodes/:id/comments?page=1` 读取当前集，使用 Bangumi 章节 ID，不使用弹弹play弹幕库 ID。对应[官方接口](https://github.com/bangumi/dev-docs/blob/master/api.json)是 `GET /p1/episodes/{episodeID}/comments`，匿名实测返回 200；仍适用新站私有 API 无兼容性保证的边界。

官方接口一次返回整集主评论和回复，没有分页参数。本项目按章节缓存完整结果 5 分钟（SWR），再在 BFF 中每页选取 20 条主评论，不向上游发送未定义的分页参数。回复随所在主评论返回，界面使用 Nuxt UI UCollapsible 按需展开。评论创建时间、缺失用户、头像失败、空结果、非法页码和重试都有对应显示；正文与番剧短评共用 BangumiCommentBody，按纯文本保留换行。

评论状态依据[官方可见规则](https://github.com/bangumi/server-private/blob/master/lib/comment.ts)及[状态定义](https://github.com/bangumi/server-private/blob/master/lib/topic/type.ts)：状态 1、2、5、6、7 使用不可见占位，不回传隐藏正文；置顶、合并、折叠等可读状态保留上游正文。主评论与回复的 mainID 都必须等于所请求章节，否则返回 502，防止串集。

页码保存在 `episodeCommentsPage` 查询参数中；切集链接回到新章节第一页。播放页的页面标识改为章节路径，不再使用完整 URL，避免评论翻页导致播放区域重建。评论请求独立于视频、弹幕和选集。

本次验证：19 个测试文件、146 项测试，以及 ESLint、Nuxt 类型检查和生产构建通过。覆盖主评论分页、回复、可见状态、跨章节数据拒绝、原番剧短评回归、切集、URL 恢复、纯文本、重试与空结果。真实 BFF 验证第 1 集 282 条主评论、第 2 集 132 条主评论；第 1 集前两页各 20 条、ID 无重叠。数值随上游更新。

浏览器验证中，只有视频源目录被模拟关闭以避免无关的多源请求，目录、评论和弹幕仍使用真实接口；不将此视为真实视频播放验收。桌面及手机截图在被 Git 忽略的 `output/playwright/episode-comments-*.png`。

## 番剧短评验证（2026-10-16）

- ESLint、Nuxt 类型检查、生产构建通过；17 个测试文件、112 项测试通过。
- 自动化覆盖固定主机、分页偏移、无 Cookie/认证头、字段裁剪、缺失头像、零评分、危险头像地址、错误响应、超时、非法页码、文本转义、URL 恢复、分页、重试和空结果。
- 真实生产 BFF 请求条目 400602：总数 8532，前两页各 20 条，第二页 offset=20，两页 ID 无重叠；数值随上游变化。
- 页码 0、10001、重复 page 参数及非数字条目 ID 返回 400。
- Edge 桌面与 390×844 手机页面验证真实评论、分页链接、日期、头像和长文本换行，无横向溢出。一次头像缩图请求因图片 CDN TLS 连接重置返回 500，组件显示占位；重试该资源返回 200。评论 JSON 请求均返回 200。
- 浏览器单独模拟评论接口 503，评论区显示重试与原页入口，详情和章节仍可用；取消模拟后点击重试恢复真实评论。
- 浏览器截图存放在 Git 忽略的 `output/playwright/comments-*.png`。真实上游验证与测试中的模拟故障分开记录；本地通过不代表已部署公网。
