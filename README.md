# Mamba-Animation

项目展示名称为 `Mamba-Animation`，npm 包名为 `mamba-animation`。为兼容已有数据，保留 `ani-*` 浏览器存储键，旧版观看记录备份仍可导入。

基于 Nuxt 4 的独立动漫网页客户端。无需登录，观看记录仅存浏览器 IndexedDB。

## 启动

要求支持 Nuxt 4 的 Node.js LTS。本项目在 Windows、Node 24.21.0 上验证。

```powershell
Set-Location D:\Code\VueProjects\animeko-web
npm ci
npm run dev -- --host 127.0.0.1 --port 3100
```

打开 [http://127.0.0.1:3100](http://127.0.0.1:3100)。生产构建与启动：

```powershell
npm run typecheck
npm run lint
npm test
npm run build
$env:HOST = '127.0.0.1'
$env:PORT = '3100'
npm start
```

本地开发可以复制 `.env.example` 为 `.env`。`npm start` 会读取项目根目录的 `.env`（如果存在），已有进程环境变量优先。直接执行 `node .output/server/index.mjs` 或使用 Docker 时仍需从运行环境传入配置。多实例部署必须配置一致的 `NUXT_PLAYBACK_SECRET`，单机未配置时生成进程级临时签名密钥，重启后旧线路凭证失效，刷新线路即可恢复。

## 已实现

- 通用能力优先采用成熟库：Nuxt UI / Nuxt Icon 负责界面及图标，Zod 负责数据入口校验，Nuxt ESLint 提供代码检查。运行 `npm run lint` 检查、`npm run lint:fix` 自动修复可修复的问题。开发约定见 [AGENTS.md](AGENTS.md)，实现细节见 [通用库与数据校验](docs/tooling-and-validation.md)。
- Bangumi 真实目录：新番时间表、搜索分页、详情、完整分页章节。
- 详情页 Bangumi 吐槽箱短评：头像、昵称、评分、收藏状态、更新时间、每页 20 条分页；只读展示，参与讨论通过原页入口。实现与验证见 [Bangumi 评论](docs/bangumi-comments.md)。
- 播放页“本集讨论”：按当前章节展示评论及楼中楼回复，支持折叠、分页、重试和切集更新；评论翻页保留播放器所在页面。
- 稀饭动漫源：搜索、章节匹配、线路选择、即时播放地址解析。
- 原生 MP4、hls.js HLS 播放；失败自动尝试其他精确匹配线路。
- 本地观看记录、暂停与切集保存、断点续播、手动已看、历史删除。
- 观看记录 JSON 导入导出：全量校验后事务写入，优先保留较新的记录。
- 本地自定义 HTTPS 视频地址绑定，地址不提交到服务器，也不包含在记录导出中。
- 本地 XML / JSON 弹幕导入、时间同步、偏移、透明度、开关。
- 弹弹play开放弹幕网络：首次打开正片时自动查询 Bangumi 映射，名称与集数明确且候选唯一时自动加载；有歧义时手动选择，尊重本地弹幕偏好，已选匹配自动恢复。包含服务端和本地缓存，需配置自己的应用凭证。
- 桌面与移动端响应式界面，窄屏导航。
- 独立播放器体验页 `/player-lab`，测试素材明确标注，不写入番剧观看记录。
- 资源签名、固定源请求边界、基础单进程限流、健康接口。

## 明确边界

- 没有登录、云同步、观看记录服务端数据库。
- 在线源是第三方服务，可能失效、要求鉴权、限制跨域或返回不兼容编码，不能保证全部番剧与线路可播。
- 初版直接播放浏览器可访问的媒体；未实现媒体代理、BT、转码、离线视频下载、ASS 字幕。
- 相近名称必须在播放页手动确认，特别篇仅匹配明确标记且集数相同的资源；不会自动把其他季度当作同一番剧。
- 在线弹幕使用 [弹弹play开放弹幕网络](https://www.dandanplay.com)，站点需申请应用凭证并遵守对应配额与使用约定。本项目没有内置凭证，不支持弹幕发送；未配置时仍可导入本地弹幕。
- 自定义地址可能过期，届时需要重新添加。
- 记录属于当前站点来源和浏览器配置。无痕模式、清除站点数据、更换域名可能导致无法继续读取。可通过 JSON 导出迁移。
- 导出只包含进度；自定义播放地址、弹幕、偏好不包含在导出中。设置页“清空观看记录”只清空进度，不是清空所有站点数据。

## 服务日志

服务端使用 [Consola](https://github.com/unjs/consola) 和 Nitro 生命周期钩子输出日志。启动显示 🐍 信息框和配置状态；API 请求显示 💬 / 📚 / 🎬 分类、状态码、耗时，以及弹幕、候选或评论数量。⚠️ 表示客户端错误，❌ 表示服务端错误，🐢 表示超过 3 秒的成功请求，👋 表示正常关闭。颜色和排版由 Consola 根据终端能力处理。

新增日志仅记录路由模板，不输出查询参数、请求头、请求体、响应正文、密钥或实际播放地址。健康检查成功和静态资源不刷屏。启动的 `configured (auth not checked)` 只表示凭证配置完整，认证以实际接口调用为准。信息框使用英文避免终端中文宽度导致边框错位，接口日志保留中文。日志在运行 `npm run dev` / `npm start` 的终端查看。

## 配置

| 环境变量                 | 作用                                               |
| ------------------------ | -------------------------------------------------- |
| `NUXT_PLAYBACK_SECRET` | 服务端资源签名密钥，生产应配置足够长的随机值       |
| `NUXT_SOURCE_ENABLED`  | `false` 关闭第三方视频源，仍可使用本地自定义地址 |
| `HOST` / `PORT`      | 生产 Node 服务监听地址和端口                       |

反向代理应正确设置 HTTPS 与超时。本应用限流直接使用连接 IP，不盲目信任客户端转发头；反向代理后的公网限流需在可信入口配置。当前容器配方未做镜像构建验证，公网部署还应完成依赖风险处置与目标浏览器验收。

## 本地弹幕格式

在线弹幕配置和验证边界见 [docs/online-danmaku.md](docs/online-danmaku.md)。

支持 Bilibili 风格 XML 的 `<d p="秒数,模式,字号,十进制颜色,...">文本</d>`，以及如下 JSON：

```json
[
  { "time": 2.5, "text": "故事开始了", "color": "#ffffff", "mode": "scroll" },
  { "time": 10, "text": "好看的画面", "color": "#bca5ff", "mode": "top" }
]
```

单文件最多 5 MB / 50000 条。弹幕按纯文本渲染，不执行 HTML。

## 验证与架构

```powershell
npm run typecheck
npm test
npm run build
```

架构、接口和阶段边界见 [docs/architecture.md](docs/architecture.md)，实测证据和未完成事项见 [docs/verification.md](docs/verification.md)。

本项目是重新编写的 Web 实现，不是 Animeko 官方网页端。参考 [Animeko](https://github.com/open-ani/animeko) 的产品与架构思路，未复制其 Kotlin/Compose 源码或品牌资产。元数据来自 [Bangumi](https://github.com/bangumi/api)，视频源发现参考 [Animeko 订阅仓库](https://github.com/creamycake-anime/animeko-subs)。
