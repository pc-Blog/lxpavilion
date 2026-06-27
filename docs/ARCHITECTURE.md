# 项目架构说明

> 栏轩阁博客系统的目录结构、组件规范和路由约定。

## 目录结构

```
app/
├── (main)/                  # 主路由组（共享布局）
│   ├── about/               # 关于页面
│   ├── analytics/           # 流量分析
│   ├── article/[id]/        # 文章列表/详情
│   ├── auth/                # 登录/注册/GitHub OAuth 回调
│   ├── chatter/             # 闲聊区
│   ├── friends/             # 友链
│   ├── gallery/             # 图库
│   ├── growth/              # 成长记录
│   ├── literature/[id]/     # 文学列表/详情
│   ├── project/[id]/        # 项目列表/详情
│   ├── timeline/            # 时间线
│   ├── tools/               # 工具页（游戏/转换器等）
│   │   ├── 2048/            # 2048 游戏
│   │   ├── file-encrypt/    # 文件加密
│   │   ├── gomoku/          # 五子棋
│   │   ├── image/           # 图片处理
│   │   ├── image-puzzle/    # 拼图
│   │   ├── json-formatter/  # JSON 格式化
│   │   ├── lights-out/      # 关灯游戏
│   │   ├── mastermind/      # 猜数字
│   │   ├── minesweeper/     # 扫雷
│   │   ├── password/        # 密码生成器
│   │   ├── qrcode/          # 二维码
│   │   ├── snake/           # 贪吃蛇
│   │   ├── sudoku/          # 数独
│   │   ├── tetris/          # 俄罗斯方块
│   │   └── wishes/          # 请愿台
│   ├── layout.tsx           # 主布局
│   ├── page.tsx             # 首页
│   └── template.tsx         # 页面模板
├── admin/                   # 管理后台（仅本地 Docker 可见）
├── _components/             # 共享组件
│   ├── admin/               # 管理后台组件
│   ├── article/             # 文章相关
│   ├── auth/                # 认证组件（GitHub 登录按钮）
│   ├── comment/             # 评论（Giscus）
│   ├── common/              # 通用组件
│   ├── effects/             # 特效（樱花/萤火虫/草地）
│   ├── layout/              # 布局组件（Header/ThemeProvider 等）
│   ├── literature/          # 文学组件
│   ├── project/             # 项目组件
│   └── timeline/            # 时间线组件
├── layout.tsx               # 根布局
└── sitemap.ts               # 站点地图（自动生成）

stores/                      # Zustand 状态管理
├── authStore.ts             # 认证（token + user）
├── contentStore.ts          # 页面内容共享（文章/项目/about 数据）
├── musicStore.ts            # 音乐播放器
└── settingsStore.ts         # 设置

workers/                     # Cloudflare Worker（api.lxpavilion.top）
└── src/
    ├── index.ts             # 路由入口
    ├── types.ts             # 环境变量类型
    ├── utils/response.ts    # 统一响应格式 + CORS
    ├── auth/                # 登录系统（账号密码 + GitHub OAuth）
    ├── chat/                # AI 看板娘对话
    ├── analytics/           # 站点流量分析
    ├── platform/            # 多平台数据统计
    ├── view/                # 文章浏览数
    └── rss/                 # RSS 代理
```

## 技术栈

| 类别       | 技术                       |
| ---------- | -------------------------- |
| 框架       | Next.js 16 + App Router    |
| 语言       | TypeScript                 |
| 样式       | Tailwind CSS               |
| 动画       | Framer Motion              |
| 图标       | Lucide React               |
| 状态管理   | Zustand                    |
| 评论系统   | Giscus (GitHub Discussions)|
| 认证       | Worker JWT + GitHub OAuth  |
| 数据库     | Cloudflare D1 (SQLite)     |
| 字体       | Geist Sans / Geist Mono    |
| 部署       | GitHub Pages（静态）/ Docker |

## Cloudflare Worker API

| 路径 | 说明 |
|:----|:------|
| `POST /ai/chat` | AI 看板娘对话 |
| `POST /api/auth/login` | 账号密码登录 |
| `POST /api/auth/register` | 注册 |
| `GET /api/auth/me` | 当前用户信息 |
| `GET /api/auth/github` | GitHub OAuth 登录 |
| `GET /api/auth/github/callback` | GitHub OAuth 回调 |
| `GET /api/view/articles` | 全部文章浏览数 |
| `POST /api/view/article/:id` | 文章浏览+1 |

## 部署

| 方式 | 后端 | 前端 | 数据库 |
|:----|:----|:----|:------|
| Docker（本地） | Java + PostgreSQL | Next.js SSR | PostgreSQL |
| GitHub Pages（线上） | Cloudflare Worker | 静态导出 | D1 (SQLite) |

静态导出时 admin/auth 页面显示「不可用」，Worker 处理所有实时功能。

## 组件规范

- `app/_components/` 下组件默认 Client Component（`"use client"`）
- 页面文件（`page.tsx`）可以是 Server Component
- 样式使用 Tailwind 原子类

## 设计规范

详见 [docs/STYLE-GUIDE.md](./STYLE-GUIDE.md)
