# CLAUDE.md – AI 智能体全局规则

> 本文件是所有 AI 编码助手的入口。请先阅读本节，再按需深入子文档。

## 项目概述

栏轩阁 — 个人博客系统，基于 Next.js 16 (App Router) + Tailwind CSS + TypeScript。

代码托管：Git

## 必读文档（请按路径读取）

| 场景                   | 文档路径               | 何时阅读                              |
| ---------------------- | ---------------------- | ------------------------------------- |
| 了解项目结构和技术选型 | `docs/ARCHITECTURE.md` | 首次进入项目或修改架构时              |
| 开发任何 UI 组件或页面 | `docs/STYLE-GUIDE.md`  | 开始写 UI 前必须阅读                  |
| 生成 Git 提交信息      | `docs/GIT.md`          | 每次提交代码前按此规范生成 commit message |

## 核心约束

- ❌ 禁止使用 `any` 类型（渐进目标，现有代码中的 `any` 逐步清理）
- ❌ 禁止直接修改 `node_modules`
- ✅ 组件统一使用 `export default function`
- ✅ 样式优先使用 Tailwind 类名，复杂样式才写自定义 CSS（参照 STYLE-GUIDE.md）
