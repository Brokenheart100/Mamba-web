# 弹弹play在线弹幕接入

日期：2026-10-16。接入的是 [弹弹play开放弹幕网络](https://www.dandanplay.com)。观看者无需登录，观看记录仍只保存在本地。

## 当前状态

已实现服务端签名请求、番剧映射、手动搜索、剧集确认、弹幕转换、两级缓存和本地导入兜底。用户尚未申请应用凭证，本轮不宣称真实上游认证、具体番剧覆盖或实际弹幕 CDN 域名通过验收。测试中的上游响应均为模拟数据。

## 配置

在 [弹弹play开发者中心](https://dev.dandanplay.com/) 创建应用并提交审核，说明 Nuxt 网页端、第三方在线播放、只读弹幕和服务端请求的实际用途。按应用审核结果、分层配额与使用约定使用。

本地开发可复制 `.env.example` 为 `.env`，填写：

```dotenv
NUXT_DANDANPLAY_ENABLED=true
NUXT_DANDANPLAY_APP_ID=你的应用编号
NUXT_DANDANPLAY_APP_SECRET=你的应用密钥
```

这些是 Nitro 私有 runtimeConfig，不能放入 `runtimeConfig.public` 或 `NUXT_PUBLIC_*`，不要提交 `.env`。生产进程通过环境变量传入，不自动读取 `.env`。配置完成后重启服务。

默认允许弹幕跳转到 HTTPS 的 `dandanplay.net`、`dandanplay.com` 及其子域。官方 CDN 若使用其他域名，确认后可用 `NUXT_DANDANPLAY_CDN_HOSTS=cdn.example.com` 添加精确主机名；不要填写任意网址、IP 或通配符。未确认的跳转会明确失败。

## 使用流程

1. 播放页先读取原有本地 XML / JSON 弹幕和本集保存的来源选择。
2. 没有确认过在线库时保持本地弹幕；点击“查找在线弹幕”首先查询官方 Bangumi 映射。
3. 核对作品名、季度和集数。映射缺失或不对时，用中文、原文名称和集数搜索；特别篇可清空集数，或按官方规则填写 S1 / O1 / C1。
4. 点击某一剧集后读取对应弹幕库，成功或有缓存时才切换；匹配关系保存在当前浏览器。
5. 后续打开本集会恢复在线来源选择。六小时内缓存直接使用；过期时保留旧内容并尝试读取，失败不清空弹幕。
6. “本地弹幕”切回导入文件并取消尚未完成的在线请求；导入新文件也切回本地。上次在线匹配仍保留。

初次选择始终需要确认。视频换源不改变章节弹幕库；剪辑差异仍需手动调整时间偏移。切集和卸载会取消客户端请求，迟到响应不能覆盖新章节或本地选择。

## 官方接口与认证

已核对 [官方 OpenAPI](https://api.dandanplay.net/swagger/v2/swagger.json)、[接入文档](https://doc.dandanplay.com/open/) 和 [变动日志](https://doc.dandanplay.com/open/changelog.html)：

| 上游接口                                                       | 用途                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------ |
| `GET /api/v2/bangumi/bgmtv/{bgmtvSubjectId}`                   | Bangumi 条目对应番剧和剧集；官方说明映射可能缺失、错误或变动 |
| `GET /api/v2/search/episodes?anime=…&episode=…&v2=true`        | 手动搜索，episode 可留空；hasMore 时提示缩小范围             |
| `GET /api/v2/comment/{episodeId}?withRelated=true&chConvert=0` | 读取关联弹幕，按官方定义处理 302 CDN 跳转                    |

应用请求使用 `X-AppId`、`X-Timestamp`、`X-Signature`。签名为 `base64(sha256(AppId + Timestamp + Path + AppSecret))`，Path 不含查询字符串。CDN 跳转不转发应用认证头，最多三次，仅允许 HTTPS、无用户信息、标准端口和允许域名。

本地 BFF 接口：

| 接口                                    | 结果                                                              |
| --------------------------------------- | ----------------------------------------------------------------- |
| `GET /api/danmaku/status`               | ready / disabled / unconfigured，不返回凭证；ready 仅表示配置完整 |
| `GET /api/danmaku/match?subjectId=…`    | 可确认的剧集列表，保留季度信息                                    |
| `GET /api/danmaku/search?q=…&episode=…` | 手动搜索结果                                                      |
| `GET /api/danmaku/{id}`                 | 归一化的 Danmaku 数组、读取时间、过滤和截断统计                   |

弹幕库 ID 使用字符串并验证正 int64 范围；不把 Bangumi episodeId 当作弹弹play episodeId。JSON 中超出 JS 安全整数范围的数值会拒绝，不使用已经丢失精度的编号。

## 缓存与边界

- 服务端搜索两小时；映射和弹幕六小时。进程内最多 100 个缓存条目 / 16 MiB，合并同一请求，最多四个不同任务并发，失败不缓存。
- 浏览器独立 `ani-online-danmaku` v1 保存选择和最近 20 集弹幕池。缓存按提供方 episodeId 共享，选择按 Bangumi subjectId:episodeId 保存。原 `ani-local-library`、`ani-local-danmaku` v1 不重建，导入文件不被在线结果覆盖。
- BFF 响应 no-store；每 IP 在线弹幕接口每分钟 30 次，状态查询沿用目录限流。多实例需要共享缓存和入口配额，本轮不引入 Redis。
- 上游总超时 12 秒、客户端 15 秒、响应最大 8 MiB。客户端取消不会取消已合并的共享上游任务，该任务仍受超时约束。
- 官方 p 字段的秒数、模式 1/4/5、RGB 转成已有 Danmaku，不返回用户 ID。过滤空文本、超过 300 字、无效模式、超出 0～86400 秒或重复数据，最多保留时间最早的 50000 条。
- 文本作为文字显示，不解释 HTML。没有 JWT 登录、发送弹幕、关注或云端播放历史接口。
- 认证失败、额度限制、数据异常和缓存不可写分别提示；在线失败不触发视频换源。

## 验证

已完成本机检查：

- 10 个文件、60 项测试通过（本轮新增 21 项），Nuxt 类型检查和生产构建通过。
- 对实际生产进程请求：status 返回 200 / unconfigured；合法的 match、search、comment 请求因没有凭证返回 503；非法 ID 和过短关键词返回 400。状态与错误响应不包含应用凭证。
- 独立 Edge 临时会话中验证未配置提示和本地导入可用；该会话与此前观看记录使用的会话分离，验证后关闭。
- 模拟资料、线路和弹幕接口，视频使用 W3C Sintel 公开测试素材，页面标题明确标注“浏览器联调”。实际操作完成本地导入 → Bangumi 映射 → 原文手动搜索 → 选择剧集 → 播放器加载两条弹幕。
- `<b>在线弹幕只是文字</b>` 在 ArtPlayer 弹幕层中作为文字出现，没有生成 b 元素。
- 刷新后恢复已确认匹配和缓存，监听浏览器请求确认没有重新读取弹幕接口；手动重新加载模拟 503 后保留原缓存。切回本地并刷新，仍显示原本的一条导入弹幕。
- 切换到另一模拟弹幕库并遇到 503，弹窗内显示错误，原已确认的匹配不被替换。
- 390 × 844 视口弹窗在屏幕边界内，Escape 正常关闭。没有 iOS / Android 真机验收。
- 这次实际 Bangumi 资料请求曾返回 502，因此完整 UI 联调使用了拦截的资料响应；这些模拟结果不代表真实番剧匹配、上游认证或弹幕 CDN 已通过验收。预期的 502 / 模拟 503 与应用运行时错误分开记录。

截图位于忽略的 `output/playwright`：`danmaku-unconfigured.png`、`online-danmaku-desktop.png`、`online-danmaku-panel.png`、`online-danmaku-fallback.png`、`online-danmaku-mobile-picker.png`、`online-danmaku-picker-error.png`。测试日志为 `output/dandanplay-tests.log`、`dandanplay-types.log`、`dandanplay-build.log`。

真实上游验收仍需要获批的应用凭证：配置后检查认证、实际 CDN 跳转域名、一个正常剧集和一个特殊篇的匹配、关联弹幕及配额提示。不使用其他项目的内置凭证。
