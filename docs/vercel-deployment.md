# Vercel 部署

项目名称：`mamba-animation`。使用 Nuxt 的 Vercel 适配，构建环境为 Node.js 24；函数运行时由 Nitro 适配输出（当前为 Node.js 22）。保留 SSR、Nitro API 及客户端播放器。

## 构建

`vercel.json` 声明 Nuxt 框架，安装命令 `npm ci`，构建命令 `npm run build`。Nuxt/Nitro 自动识别 Vercel 环境；配置中不固定 `node-server`。普通本地生产构建仍使用默认 Node 服务器，可执行 `npm start`。

本地检查 Vercel Build Output：

```powershell
$env:NITRO_PRESET = 'vercel'
$env:VERCEL = '1'
npm run build
Remove-Item Env:NITRO_PRESET
Remove-Item Env:VERCEL
```

输出为 `.vercel/output/`，由 Nitro 生成函数、静态资源和路由。该目录不提交到 Git；`.vercelignore` 同时排除本地环境文件、缓存和浏览器验证产物。

封面使用 Nuxt Image 的平台默认 provider：本地默认 IPX，Vercel 自动使用其图片优化服务；不在组件中固定为 IPX。外部导入封面继续直接加载。

## 服务端环境变量

在 Vercel 项目中为 Production / Preview 分别配置私密变量：

| 变量 | 用途 |
| --- | --- |
| `NUXT_PLAYBACK_SECRET` | 足够长的随机签名密钥，所有实例使用相同值；否则跨实例解析线路会失败 |
| `NUXT_DANDANPLAY_APP_ID` | 弹弹play应用编号 |
| `NUXT_DANDANPLAY_APP_SECRET` | 弹弹play应用密钥 |
| `NUXT_DANDANPLAY_ENABLED` | 按需设为 `true` / `false` |
| `NUXT_DANDANPLAY_CDN_HOSTS` | 仅在官方实际跳转需要时配置 |
| `NUXT_SOURCE_ENABLED` | 默认启用，设为 `false` 可关闭第三方在线源 |

不上传 `.env`，不使用 `NUXT_PUBLIC_*` 暴露密钥，也不把本机 `HOST`、`PORT` 传到 Vercel。修改远端环境变量后需重新部署才能应用。

## 验收

构建 READY 后，检查首页、`/api/health`、Bangumi 目录与章节、评论、弹幕实际认证以及样例线路解析；使用浏览器验证页面、选集和播放器。若部署受默认访问保护，使用现有 Vercel 授权检查，不为测试关闭保护。

自定义域名单独在项目的 Domains 中绑定，DNS 的实际 A/CNAME 值以 Vercel 针对该项目返回的结果为准。

## 当前架构边界

- 观看记录、本地弹幕和地址绑定仍在浏览器；从 localhost 或临时域名换到正式域名时，观看记录需通过导出/导入迁移。
- 服务端缓存与限流按实例运行，不能视为跨实例共享缓存或全站统一配额。实例回收会丢失内存缓存；没有引入收费数据库或缓存服务。
- Bangumi、弹弹play和第三方视频源需要从部署区域实际验证；本地可达和构建成功都不能代替线上验收。
- 浏览器直接请求媒体，第三方站点的鉴权、跨域及区域限制仍可能导致某些线路不可播。

官方参考：[Nuxt on Vercel](https://vercel.com/docs/frameworks/full-stack/nuxt)。
