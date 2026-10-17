# 通用库与数据校验

## 选型原则

优先使用现有依赖和维护活跃的成熟库，核对当前版本的官方 API 后接入。仅为业务规则编写必要代码，避免另建通用组件、图标映射、校验框架或存储封装。

## 图标

界面图标统一使用 Nuxt UI 的 `UIcon`，通过 Nuxt Icon 加载已安装的 `@iconify-json/lucide`。Nuxt UI 自动注册 Nuxt Icon，配置中不重复注册模块。统一使用 SVG 模式以兼容原有图标布局样式；尺寸使用组件原生 `size` 属性。

旧的 `AppIcon` 映射组件和 `@lucide/vue` 依赖已移除。

## 代码检查

通过 `@nuxt/eslint` 生成 Nuxt 项目配置，根目录 `eslint.config.mjs` 复用 `.nuxt/eslint.config.mjs`。不手写 Vue、TypeScript 或 Nuxt 自动导入规则，不关闭规则来隐藏已有问题。

- `npm run lint`：检查源代码，警告也导致失败。
- `npm run lint:fix`：自动修复支持修复的问题。
- `npm run typecheck`：检查类型。
- `npm test`：运行单元及 Nuxt 组件测试。
- `npm run build`：生成 Node 服务产物。

## Zod 数据入口

Schema 放在 `shared/schemas/`，观看记录、弹幕及在线匹配类型通过 `z.infer` 推导。

| 入口 | 使用方式 |
| --- | --- |
| 搜索关键词、集数、分页、弹幕库 ID 和播放请求 | H3 原生 `getValidatedQuery`、`getValidatedRouterParams`、`readValidatedBody` 配合 Zod `parse` |
| 条目路由 ID | 共享 Zod schema 校验 |
| 观看记录 JSON 导入 | 完整验证版本、记录数量和每条记录后才写入；保留文件大小上限 |
| 本地观看记录读取 | 校验持久化数据，忽略损坏记录，不影响有效记录 |
| XML / JSON 弹幕导入 | XML 仍用浏览器 DOMParser 解析，转换后交给 Zod 校验；保留顺序、默认颜色和模式 |
| 在线匹配和搜索结果 | 校验官方返回的匹配项及浏览器收到的归一化结果 |
| 在线弹幕池、本地弹幕和来源选择缓存 | 读取及写入时校验；仍检查弹幕池 ID 与缓存键一致 |
| 播放源本地偏好 | 先校验字符串数组，再过滤不存在的源 |

弹幕库编号继续使用十进制字符串，拒绝不安全的 JS 数值和超出正 int64 范围的编号。弹幕文本保持原样并按纯文本显示，不解释 HTML。文本限制继续按原有 UTF-16 长度判断。

设置的范围收敛和旧字段默认值、弹幕转换和去重、缓存配额及有效期仍属于业务规则；缓存的过期判断和淘汰机制交给下述成熟库。数据库名称、版本与 `ani-*` 存储键不变，旧备份的 `app` 标记不影响导入。

## 服务端基础能力

- 请求限流使用 `rate-limiter-flexible` 的 `RateLimiterMemory`：同一 IP 按在线弹幕、视频源和目录分组，分别允许每 60 秒 30、120、180 次。状态接口仍使用目录额度；超限返回 429 和 `Retry-After`。
- 限流保持最多 10000 个活跃 IP / 类别组合。用 `lru-cache` 跟踪准入容量和到期清理；容量满时拒绝新组合并返回 503，不淘汰尚有效的计数器，避免绕过配额。限流仍是单进程范围，多实例部署需使用共享限流后端。
- 弹幕服务端缓存使用 `lru-cache`：最多 100 项、16 MiB，搜索两小时、映射和弹幕六小时。访问刷新 LRU 顺序，不延长有效期，失败不缓存；超出单项容量的结果不存入缓存。
- 最多四个不同上游任务和相同任务合并仍保留为少量业务协调代码。尚在请求中的任务独立于已完成结果缓存，因此缓存淘汰不会导致同一任务被重复发起。
- Bangumi 使用 Nuxt `$fetch` 序列化 JSON、处理查询参数和响应；保留固定上游地址、应用 User-Agent、12 秒超时和中文错误映射，并显式关闭自动重试。原有 Nitro `defineCachedFunction` 缓存继续复用。
- 弹弹play仍使用原生 Fetch 手动处理认证和 CDN 跳转，并保留 8 MiB 响应体上限；这部分是提供方协议与安全边界，不能用普通 JSON 请求的默认行为替代。

## 本次验证（2026-10-16）

- ESLint 零错误、零警告，类型检查和生产构建通过；11 个测试文件、67 项测试通过。
- 实际生产服务中，重复查询参数、负数分页、非法集数和编号、错误播放请求均返回 400，提示保留中文信息。
- 独立 Edge 会话验证播放器体验页的桌面及 390 × 844 布局，SVG 图标尺寸正常，无页面横向溢出和应用控制台错误。
- 在该独立会话通过文件选择器导入损坏备份：显示拒绝提示且记录仍为零；随后导入旧 `app` 标记的测试备份，进入观看记录页面后恢复一条记录和 00:45 播放进度。测试数据与用户常用浏览器会话隔离。
- 前端产物和检查的接口响应未发现本地应用凭证。弹弹play真实请求仍被上游拒绝认证，库迁移不代表上游接入已通过。
- 本地验证日志和截图位于忽略的 `output/tooling-build.log`、`output/tooling-smoke.json`、`output/playwright/tooling-*.png`。

## 服务端重构验证（2026-10-16）

- ESLint 零错误、零警告，类型检查和生产构建通过；13 个测试文件、79 项测试通过。
- 新增测试覆盖限流并发、IP / 类别隔离、窗口恢复、容量拒绝及 HTTP 429 响应头；缓存覆盖 100 条 LRU 淘汰、16 MiB 总容量及四任务并发；Bangumi 覆盖实际 ofetch 序列化、分页、错误映射和 12 秒超时。
- 3100 已有开发服务，未停止它。另在 3101 启动生产产物验证：Bangumi 条目 400602 返回 200 / 葬送的芙莉莲，搜索返回 200 / 5 个结果。
- 对非法弹幕 ID 请求 31 次：前 30 次进入参数校验并返回 400，第 31 次返回 429 / `Retry-After: 60` / 中文限流提示，状态接口仍返回 200。该验证没有向弹弹play发起请求。
- 前端产物和检查的响应未发现本地应用凭证。此轮没有重新验证弹弹play上游认证。
- 结果记录在忽略的 `output/infrastructure-tests.log`、`output/infrastructure-types.log`、`output/infrastructure-build.log`、`output/infrastructure-smoke.json`。

## 参考链接

- [rate-limiter-flexible 使用示例](https://github.com/animir/node-rate-limiter-flexible/wiki/Overall-example)
- [lru-cache 官方说明](https://github.com/isaacs/node-lru-cache)
- [ofetch（Nuxt `$fetch` 底层）](https://github.com/unjs/ofetch)

- [Nuxt ESLint 官方模块](https://eslint.nuxt.com/packages/module)
- [Nuxt Icon](https://github.com/nuxt/icon)
- [Zod schema API](https://zod.dev/api)
- [H3 数据校验](https://h3.dev/examples/validate-data)；具体回调类型以项目安装的 H3 类型声明和集成测试为准。
