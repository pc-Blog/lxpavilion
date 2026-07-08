/**
 * Cloudflare Worker — 博客流量分析 API 代理
 *
 * 所有响应统一为 { code, data, msg } 格式。
 *
 * 环境变量（必填）:
 *   CF_API_TOKEN  — Cloudflare API Token（需 Cache:Purge + Analytics:Read 权限）
 *   CF_ZONE_ID    — Cloudflare 区域 ID
 *
 * 环境变量（选填——/platform 接口需要）:
 *   CSDN_USER       — CSDN 用户名
 *   JUEJIN_USER_ID  — 掘金用户 ID
 *   CNBLOGS_BLOGAPP — 博客园 blogApp
 */

import type { Env } from "./types";
import { corsHeaders, respond } from "./utils/response";
import { handleAnalytics } from "./analytics/handler";
import { handlePlatform } from "./platform/handler";
import { handleRss } from "./rss/handler";
import { handlePurge } from "./purge/handler";
import { handleChat } from "./chat/handler";
import { handleAuth } from "./auth/handler";
import { handleView } from "./view/handler";
import { handleComment } from "./comment/handler";
import { handleEmail } from "./email/handler";
import { handleSubscribe } from "./subscribe/handler";
import { handleVerifySubscribe, handleDeleteSubscribe } from "./subscribe/api";
import { handleUnsubscribe } from "./subscribe/unsubscribe";
import { handleRssPush, handleRssPushDetail, handleRssPushCount, handleRssPushDeleteAll } from "./rss-push/handler";
import { handleHotPush } from "./hot-topics/handler";
import { handleSync } from "./sync/handler";
import {
  handleList as handleEmailList,
  handleDetail as handleEmailDetail,
  handleDelete as handleEmailDelete,
  handleGetForward,
} from "./email/api";
import { handleSend } from "./email/send";

export default {
  // ── Email 入口（由 Cloudflare Email Routing 触发） ──
  async email(
    message: ForwardableEmailMessage,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    await handleEmail(message, env, ctx);
  },
  // ── Cron 入口（RSS 推送 00:00 UTC / 热点推送 01:00 UTC） ──
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    if (event.cron === "0 1 * * *") {
      await handleHotPush(env);
    } else {
      await handleRssPush(env);
    }
  },
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    // ── OPTIONS 预检（不依赖环境变量，否则浏览器 CORS 失败） ──
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    // ── 检查必填环境变量 ──
    const missing: string[] = [];
    if (!env.CF_API_TOKEN) missing.push("CF_API_TOKEN");
    if (!env.CF_ZONE_ID) missing.push("CF_ZONE_ID");
    if (missing.length > 0) {
      return respond(
        null,
        `Worker 配置不完整：${missing.join(", ")}`,
        0,
        origin
      );
    }

    // ── 路由 ──

    // GET /ping — 健康检查
    if (request.method === "GET" && url.pathname === "/ping") {
      return respond({ status: "ok", message: "Worker is alive" }, "ok", 1, origin);
    }

    // GET /platform — 多平台统计
    if (request.method === "GET" && url.pathname === "/platform") {
      return handlePlatform(request, env, ctx, origin);
    }

    // GET /rss?url=... — RSS 代理（1h 缓存）
    if (request.method === "GET" && url.pathname === "/rss") {
      return handleRss(request, env, ctx, origin);
    }

    // POST / — 获取完整分析数据
    if (request.method === "POST" && url.pathname === "/") {
      return handleAnalytics(request, env, ctx, origin);
    }

    // POST /purge — 清空 CDN 缓存
    if (request.method === "POST" && url.pathname === "/purge") {
      return handlePurge(request, env, ctx, origin);
    }

    // POST /ai/chat — AI 看板娘对话（测试用）
    if (request.method === "POST" && url.pathname === "/ai/chat") {
      return handleChat(request, env, origin);
    }

    // /api/auth/* — 用户认证
    if (url.pathname.startsWith("/api/auth")) {
      return handleAuth(request, env, origin);
    }

    // /api/view/* — 浏览数
    if (url.pathname.startsWith("/api/view")) {
      return handleView(request, env, origin);
    }

    // /api/comment/* — 评论
    if (url.pathname.startsWith("/api/comment")) {
      return handleComment(request, env, origin);
    }

    // /api/email/* — 邮件管理
    if (url.pathname.startsWith("/api/email")) {
      switch (true) {
        case request.method === "GET" && url.pathname === "/api/email/list":
          return handleEmailList(request, env, origin);
        case request.method === "GET" && url.pathname === "/api/email/detail":
          return handleEmailDetail(request, env, origin);
        case request.method === "DELETE" && url.pathname === "/api/email/delete":
          return handleEmailDelete(request, env, origin);
        case request.method === "GET" && url.pathname === "/api/email/forward":
          return handleGetForward(request, env, origin);
        case request.method === "POST" && url.pathname === "/api/email/send":
          return handleSend(request, env, origin);
        default:
          return respond(null, "Not Found", 0, origin);
      }
    }

    // POST /api/subscribe — 邮件订阅
    if (request.method === "POST" && url.pathname === "/api/subscribe") {
      return handleSubscribe(request, env, origin);
    }

    // GET /api/subscribe/verify — 验证 D1 与 MailerLite 数据一致性
    if (request.method === "GET" && url.pathname === "/api/subscribe/verify") {
      return handleVerifySubscribe(request, env, origin);
    }

    // POST /api/subscribe/delete — 从 D1 和 MailerLite 同步删除订阅者
    if (request.method === "POST" && url.pathname === "/api/subscribe/delete") {
      return handleDeleteSubscribe(request, env, origin);
    }

    // GET/POST /api/unsubscribe — 自定义退订
    if (url.pathname === "/api/unsubscribe") {
      return handleUnsubscribe(request, env, origin);
    }

    // POST /api/rss-push — 手动触发 RSS 推送（用于测试）
    if (request.method === "POST" && url.pathname === "/api/rss-push") {
      const pushResult = await handleRssPush(env);
      return respond(
        { pushed: true, push_log_id: pushResult?.id ?? null, campaign_id: pushResult?.campaign_id ?? null, status: pushResult?.status ?? null },
        "RSS push completed",
        1,
        origin,
      );
    }

    // POST /api/hot-push — 手动触发热点推送（用于测试）
    if (request.method === "POST" && url.pathname === "/api/hot-push") {
      const pushResult = await handleHotPush(env);
      return respond(
        { pushed: true, push_log_id: pushResult?.id ?? null, campaign_id: pushResult?.campaign_id ?? null, status: pushResult?.status ?? null },
        "Hot push completed",
        1,
        origin,
      );
    }

    // DELETE /api/rss-push — 清空所有推送日志
    if (request.method === "DELETE" && url.pathname === "/api/rss-push") {
      return handleRssPushDeleteAll(env, origin);
    }

    // GET /api/rss-push/count — 推送日志总数
    if (request.method === "GET" && url.pathname === "/api/rss-push/count") {
      return handleRssPushCount(env, origin);
    }

    // GET /api/rss-push/detail?id=N — 查询单条推送日志
    if (request.method === "GET" && url.pathname === "/api/rss-push/detail") {
      return handleRssPushDetail(request, env, origin);
    }

    // /api/sync/* — 数据同步（供 Java 后端拉取）
    if (url.pathname.startsWith("/api/sync")) {
      return handleSync(request, env, origin);
    }

    // 404 兜底
    return respond(null, "Not Found", 0, origin);
  },
};
