<div align="center">

# 栏轩阁 · LanXuan Pavilion

**个人技术博客与作品集 — 全栈一体化博客系统**
[![GitHub Pages](https://img.shields.io/github/actions/workflow/status/pc-Blog/lxpavilion/deploy.yml?branch=master&label=GitHub%20Pages)](https://github.com/pc-Blog/lxpavilion/actions)
[![GitHub release](https://img.shields.io/github/v/release/pc-Blog/lxpavilion?include_prereleases&logo=next.js&label=Release)](https://github.com/pc-Blog/lxpavilion/releases)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-339933?logo=node.js&logoColor=white)](package.json)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](package.json)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](package.json)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen)](https://github.com/pc-Blog/lxpavilion/pulls)

**在线体验：[https://www.lxpavilion.top](https://www.lxpavilion.top)** ✨

</div>

---

> 一个集技术文章、项目展示、摄影图库、文学创作、在线小工具于一体的个人博客系统。前端基于 Next.js 16 App Router 构建，后端由 Spring Boot 4 + Java 21 驱动，支持 GitHub Pages 静态部署与 Docker 容器化运行，配备完整的管理后台与 GitHub 数据同步流水线，并高度集成 Cloudflare 生态（域名、Analytics、Worker 后端、Workers AI 等）。

---

## ✨ 特性

**核心内容**
- 博客文章：Markdown 写作、分类/标签/系列、阅读量统计、发布/草稿管理
- 项目展示：只存 GitHub 仓库地址，名称/描述/Star/Fork/活跃时间/许可证/官方 Topics/语言占比等信息**由前端实时调用 GitHub API 获取**（1 小时本地缓存）；卡片含 recharts 环形语言扇形图（悬浮扇区外扩 + Tooltip 显示语言与占比）、🌐 主页/Demo 跳转、🕓 相对活跃时间、📄 许可证徽标、🚩 已归档角标、始于年份，并支持按仓库名/描述/官方 Topics/GitHub 地址的内存搜索过滤
- 图库与相册、说说动态、友链（含 RSS 订阅源文章预览，Cloudflare Worker 代理抓取）、书签、文学创作、学习历程/成长记录

**登录与评论**
- 账号密码注册登录 + GitHub OAuth
- Giscus 评论（GitHub Discussions）与评论反应/点赞

**流量统计**
- Cloudflare Analytics 站点流量统计
- 第三方博客平台（CSDN / 掘金 / 博客园）数据聚合展示

**娱乐与工具**
- 小游戏（2048、数独、俄罗斯方块、五子棋、扫雷…）、在线工具（图片处理、JSON 格式化、密码生成…）、许愿墙

**样式与交互**
- 看板娘 Live2D（可 AI 聊天）、背景轮播、粒子特效、弹幕、涟漪、音乐播放器、深浅主题切换、全局设置面板

**SEO 与订阅**
- RSS Feed、结构化数据（JSON-LD）、Open Graph、Sitemap、统一 SEO 配置
- 文章订阅、RSS / 热点邮件推送（IndexNow 自动推送）

**后台管理**
- 全部内容增删改查、GitHub 部署状态查看、数据同步控制台、站点数据看板

**部署与数据同步**
- Docker 容器化部署、GitHub Pages 静态导出、JSON/媒体/音乐数据同步流水线（master/data 双分支驱动）

**Cloudflare 高度集成**
- 域名接入与 HTTPS、流量统计（Worker + Analytics API）、Worker 后端（订阅/邮件/评论/登录/热点/看板娘 AI 等）、Workers AI、Worker 数据层（D1 数据库）、GitHub App 凭据（installation token，用于服务端仓库读写）

**邮箱服务**
- 订阅列表、邮件通知，支持邮箱注册，内置简易的个人邮箱系统

---

![首页](asset/1.png)
![统计](asset/2.png)
![后台](asset/3.png)
![照片墙](asset/4.png)

---

## 🚀 快速开始

### 前置要求

- **Node.js** >= 18（推荐 22，Docker 镜像基于 Node 22）
- **npm** 或 **pnpm**
- 后端服务：请搭配 [pc-Blog/backend](https://github.com/pc-Blog/backend)（Spring Boot 4）使用

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/pc-Blog/lxpavilion.git
cd lxpavilion

# 安装依赖
npm install

# 启动开发服务器（Turbopack）
npm run dev          # 访问 http://localhost:3000
```

### 生产构建

```bash
# 常规模式（standalone 输出，用于 Docker）
npm run build

# 静态导出模式（用于 GitHub Pages，读取 /data 静态数据）
npm run build:static    # = STATIC_EXPORT=true npm run build，将 next.config 的 output 切换为 export

# 其他
npm run start        # 运行 standalone 产物
npm run lint         # ESLint 检查
```

> `postbuild` 钩子会自动向搜索引擎提交 IndexNow 索引推送。
> 静态导出时前端从 `/data/` 读取静态 JSON；GitHub Pages 部署（`.github/workflows/deploy.yml`）会额外注入环境变量 `NEXT_PUBLIC_IS_STATIC=true`，强制前端进入静态数据层。本地单独运行 `npm run build:static` 不设该变量，页面会通过 `/data/index.json` 探测自动降级。

### 关键配置

所有核心配置集中在 [`lib/siteConfig.ts`](lib/siteConfig.ts) 中：

| 配置项 | 说明 | 必填 |
|--------|------|------|
| `title` / `authorName` / `bio` / `seoDescription` | 站点标题、作者名、简介、SEO 描述 | ✅ |
| `blog` / `hasDomain` | 站点域名（是否有自定义域名，决定 CNAME 生成） | ✅ |
| `repo` / `repoId` | GitHub 仓库名与仓库 ID（用于同步与评论） | ✅ |
| `giscusCategory` / `giscusCategoryId` | Giscus 评论区分类 | ✅ |
| `backUrl` | Java 后端 API 地址（如 `localhost:18016`） | ✅ |
| `workerApi` / `hotspot` | Cloudflare Worker API 域名与热点服务域名 | ❌ |
| `ZoneID` | Cloudflare Zone ID | ❌ |
| 社交链接 | GitHub / Gitee / 掘金 / CSDN / 博客园 / QQ / 邮箱 | ❌ |
| `featureXxx` 功能开关 | 第三方服务未配置时按需降级/隐藏功能（Analytics/评论/登录/AI 聊天等） | ❌ |

> Cloudflare Worker 配置在 [`workers/wrangler.jsonc`](workers/wrangler.jsonc) 中（路由域名、Zone ID、平台账号 ID、环境变量密钥等，注意勿将真实密钥提交到仓库）。

---

## 🚢 部署

### Docker 部署

```bash
# 构建镜像
docker build -t blog-next .

# 运行容器（在后端项目里执行，同时部署前后端、PostgreSQL、MinIO、Nginx）
docker compose -f docker-compose.yml up -d
```

构建产物使用 Next.js 的 `standalone` 模式，镜像基于 `node:22-alpine`，体积小、启动快。后端地址通过 `lib/siteConfig.ts` 中的 `backUrl` 配置。

### GitHub Pages 静态部署

**CI/CD 自动化部署**（[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)）：

1. 推送 `master` 或 `data` 分支触发 Actions
2. Actions 检出源代码（master）+ `data` 分支的静态数据
3. 将数据文件复制到 `public/data/` 目录
4. 执行 `npm run build:static`（环境变量 `NEXT_PUBLIC_IS_STATIC=true`）
5. 根据 `siteConfig.hasDomain` 自动生成 CNAME 文件
6. 通过 `peaceiris/actions-gh-pages` 将产物推送到 `gh-pages` 分支
7. 仓库 Settings → Pages 将发布源指向 `gh-pages` 分支即可线上生效

**数据同步流水线：**

在管理后台的「数据同步/GitHub 同步」中执行 JSON / 媒体 / 音乐同步，数据会被推送到 `data` 分支；`master` 或 `data` 分支有推送即自动触发重新构建并部署到 Pages。

### Fork 部署自己的站点

修改以下文件即可移植到自己的环境：

| 文件 | 改动内容 |
|------|---------|
| [`lib/siteConfig.ts`](lib/siteConfig.ts) | 域名、仓库名与 ID、作者信息、后端地址、社交链接、Giscus、功能开关 |
| [`workers/wrangler.jsonc`](workers/wrangler.jsonc) | Worker 路由域名、Zone ID、平台账号 ID、环境变量（密钥勿入库） |

Giscus 评论需在新仓库 Settings 中开启 Discussions，然后到 [giscus.app](https://giscus.app) 获取 `categoryId` 填入 `siteConfig.ts`。

#### Cloudflare 配置说明

项目深度集成 Cloudflare 生态（仅部署博客核心可不配置，通过 `siteConfig.ts` 的功能开关关闭对应模块）：

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare 账号
wrangler login

# 部署 Worker
cd workers
wrangler deploy
```

**配置路由：** 修改 `workers/wrangler.jsonc` 中的 `routes` 字段，将 `api.lxpavilion.top` 替换为你的域名。Worker 配置了 `custom_domain: true`，也可在 Cloudflare 面板绑定自定义域。

---

## 📓 Obsidian 插件

仓库内置 [Obsidian 插件](obsidian-plugin/)（`obsidian-plugin/`），可在 Obsidian 中便捷地管理博文（分类/标签选择、内容同步、发布协助等），让写作与博客发布无缝衔接。

---

## ⚠️ 上手提示

本项目除博客的通用功能（文章、相册、说说、友链、书签、文学创作、在线工具等）外，还**大量依赖第三方服务且高度定制化**，要完整跑通全站功能需要逐一申请并配置，**上手门槛较高**：

| 依赖 | 用途 |
|------|------|
| **Cloudflare（高度集成）** | 域名与 HTTPS、Worker 后端（订阅/邮件/评论/登录/热点/看板娘 AI/浏览数/友链 RSS 代理）、Workers AI、D1 数据库、Analytics API、CDN 缓存 |
| **GitHub API** | GitHub OAuth 登录、项目卡片数据（仓库信息与语言占比）、数据同步（git blob/tree/commit 推送 `data` 分支）、部署状态查看 |
| **GitHub Discussions（Giscus）** | 评论区与评论反应 |
| **Resend** | 注册欢迎邮件、订阅/退订通知、RSS 与每日热点邮件群发 |
| **Java 后端 [pc-Blog/backend](https://github.com/pc-Blog/backend)** | 全部内容数据的持久化与接口（PostgreSQL + MinIO） |

> 只想**本地体验或部署博客核心功能**：可在 [`lib/siteConfig.ts`](lib/siteConfig.ts) 中把对应的 `featureXxx` 开关设为 `false`，相关模块会从前端隐藏并友好降级，无需配置对应第三方服务。
> 想**完整复刻线上站点**：需按上文「部署」章节逐个申请并配置上表服务（Cloudflare Worker / D1、GitHub OAuth 与 Giscus、Resend、Java 后端等）。

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

---

## 💡 致谢

### 参考与灵感

感谢以下博主的开源分享，本项目的设计和实现参考了他们的优秀作品：

- **[XingHuiSamaの宝藏之地](https://www.xinghuisama.top)** — 项目主体样式布局和整体功能的主要参考来源
- **[流欺不欺](https://blog.lqay.cn/)** — 部分功能与样式参考
- **[Starhiroの小站](https://boke.hiromu.top/)** — 部分功能与样式参考

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/PC2005-cloud">ppc</a></sub>
</div>