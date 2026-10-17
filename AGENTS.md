# 项目开发约定

- 优先使用成熟、维护活跃且适配当前版本的库及官方组件。引入前检查现有依赖和官方文档，避免重复实现已有能力。
- 页面组件使用 Nuxt UI；图标统一使用 `UIcon` 和已有的 Lucide Iconify 集合。Nuxt UI 已自动注册 Nuxt Icon，不要重复注册模块或另建图标映射封装。
- 外部输入、导入文件和缓存读取在数据入口使用 `shared/schemas/` 中的 Zod schema；类型优先从 schema 推导。H3 请求校验使用其内置的 validated query/body/params API。
- 保留必要的业务逻辑：弹幕转换、去重、缓存配额及有效期、视频源适配和设置容错。通用机制优先交给成熟库：限流使用 `rate-limiter-flexible`，有容量上限的服务端缓存使用 `lru-cache`，普通 JSON 上游请求使用 Nuxt `$fetch`。
- 弹弹play请求保留手动跳转、域名检查、总超时和响应体上限，CDN 请求不得转发应用认证头。不要为了统一请求工具而移除这些规则。
- 保持无登录、观看记录仅存本地。保留现有 IndexedDB 名称、版本及浏览器存储键，兼容旧版记录备份。
- 凭证只放服务端私有配置，不写入前端、文档或 Git。配置完整不代表上游认证成功，验证报告须区分模拟测试与真实上游结果。
- 提交改动前按影响运行 `npm run lint`、`npm run typecheck`、`npm test` 和 `npm run build`；界面改动应验证实际渲染。
