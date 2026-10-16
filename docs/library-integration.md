# 已安装库的实际接入

日期：2026-10-16。此次把已有依赖接入实际功能，不增加账户、云同步或服务端观看记录。

## 分工

| 库                      | 使用位置                                                                | 职责                                                                          |
| ----------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `@nuxt/image`           | `app/components/AnimeCover.vue`，首页、番剧卡片、详情、继续观看和历史页 | 统一封面尺寸、响应式 srcset、WebP、普通封面懒加载、首屏主图优先加载和失败占位 |
| `@pinia/nuxt` / `pinia` | `app/stores/local-library.ts`、`source-preferences.ts`                  | 跨页面观看记录、加载与错误状态、启用源和会话检测状态                          |
| `@vueuse/nuxt`          | `app/layouts/default.vue`、`components/player/VideoPlayer.vue`          | 侧栏偏好、响应式媒体查询、Escape 关闭导航、页面隐藏和离开时的播放器补写监听   |
| `@nuxt/test-utils`      | `vitest.config.ts`、`tests/nuxt`                                        | Nuxt 环境中的组件挂载、Pinia 和 Nuxt Image 集成验证                           |

## 状态与持久化

Pinia 管理应用实例内的共享状态，仓储层继续使用原有 IndexedDB。`useLocalLibrary` 和 `useSourcePreferences` 保留原接口，通过 `storeToRefs` 返回响应式状态和绑定的 Store action；调用 Store 时显式传入 `usePinia()`，使用当前 Nuxt 请求 / 应用的实例，不依赖全局 activePinia。

本地记录加载只在客户端执行；不同 SSR 请求由 Nuxt 的 Pinia 插件隔离。刷新采用递增编号，较早的慢请求不能覆盖较新的结果；读取失败时保留会话内已有列表并显示错误。

源偏好保留 `ani.source-preferences.v1` 键，过滤已移除的源并去重，明确保存的空数组表示全部关闭。写入失败时当前会话的选择仍然有效。观看记录、弹幕和播放设置数据库版本仍为 v1，没有删除或重建旧数据库。

VueUse `useLocalStorage` 保留侧栏原键 `ani.sidebar-hidden`，在挂载后读取以避免水合差异，默认值不主动写入。`useMediaQuery` 对齐 CSS 的 900px 断点，切换宽度时关闭移动导航。`useEventListener` 随组件作用域自动清理监听。播放器自身的 HLS、ArtPlayer 销毁和补写逻辑保持原职责。

## 图片边界

IPX 只允许元数据封面域名 `lain.bgm.tv`。导入记录中的其他 HTTP(S) 封面采用 `none` provider，由浏览器直连，不进入服务端优化接口。空地址、非 HTTP(S) 地址或加载失败显示本地 SVG 占位；切换图片后重新尝试加载。

首页主图与详情封面为 eager，其余为 lazy；提供宽高、sizes 与 1x / 2x 候选。Nuxt Image 输出原生 img，不增加影响布局的外层容器。

生产输出包含本机架构的 sharp 二进制。部署到 Linux / 容器时应在目标环境重新构建，不能直接复制 Windows 的 `.output`。现有 Dockerfile 在镜像内构建，容器本次尚未实测。

## 测试组织

- 原有 30 项纯逻辑 / 仓储测试继续运行在 Node 环境。
- 新增 9 项 Nuxt 集成测试，覆盖记录渲染与去重、已看与删除的响应更新、读失败保留状态、迟到读取不覆盖新数据、双组件源偏好同步、全部关闭与恢复默认、损坏配置与写入失败、响应式图片与失败回退、外部封面不代理和非法协议拒绝。
- `mountSuspended` 使用实际 Nuxt 组件环境；IndexedDB 使用 fake-indexeddb，不依赖远程接口。
- 测试构建目录为 `.nuxt/test`，与普通构建隔离。测试工具移入 devDependencies，由 `defineVitestProject` 在测试时加载模块，生产模块列表不包含测试工具。
- Nuxt Test Utils 4.3.3 / Vitest 5 在此 Windows 环境的虚拟入口丢失盘符。测试配置将入口指向实际 Nuxt entry 文件，并保留官方测试 root 的替换。兼容代码仅用于测试，没有修改依赖包；升级后可复查是否仍需要。
- Nuxt 的 IndexedDB 模拟仅提供 factory，setup 同步补齐 idb 使用的 IDB 构造器。

## 官方依据

- [Nuxt Image 组件](https://image.nuxt.com/usage/nuxt-img)、[配置](https://image.nuxt.com/get-started/configuration)
- [Pinia 与 Nuxt](https://pinia.vuejs.org/ssr/nuxt.html)
- [VueUse useStorage](https://vueuse.org/core/usestorage/)、[useMediaQuery](https://vueuse.org/core/usemediaquery/)、[useEventListener](https://vueuse.org/core/useeventlistener/)
- [Nuxt 测试](https://nuxt.com/docs/4.x/getting-started/testing)，同时核对本地安装包的类型与运行时源码。

## 本机验证

本机 Windows / Edge 验证结果：

- 7 个测试文件、39 项通过（30 项原有测试 + 9 项 Nuxt 集成测试）；类型检查与最终生产构建通过。
- 最终生产服务在 `http://127.0.0.1:3100` 运行。首页、源管理、番剧详情、历史、设置、播放器体验与健康接口均返回 200。首页与详情的服务端渲染已实际检查，没有 Pinia 实例错误；客户端运行时测试不能替代这项检查。
- IPX 实际请求返回 200 / `image/webp`，样例封面 9092 字节；首页主图、卡片和已有“继续观看”封面实际加载成功。
- 旧观看记录仍显示芙莉莲第 1 话的 02:22 进度，未重建数据库。源开关跨页面导航与刷新后保持一致；完成验证后恢复原源偏好。
- 桌面侧栏隐藏后刷新仍隐藏，验证后恢复原偏好；390 × 844 视口没有横向溢出，移动导航可按 Escape 关闭，切回桌面自动收起。
- 播放器体验页的 MP4 实际播放、定位和暂停，触发 pagehide 后再离开页面，返回首页正常；体验页仍不写入观看记录。
- Edge 控制台没有新增应用错误，只有浏览器关于懒加载图片的提示。截图位于忽略的 `output/playwright/libraries-desktop.png` 和 `libraries-mobile.png`。

这轮不宣称 iOS / Android 真机或容器部署通过。依赖审计仍报告 12 项（1 low、11 high），未执行强制版本变更。
