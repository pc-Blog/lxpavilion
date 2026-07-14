import { respond } from "../utils/response";
import type { Env } from "../types";
import bcrypt from "bcryptjs";

import resetCodeTpl from "./reset-code.html";
import welcomeTpl from "./welcome.html";
import deletedTpl from "./deleted.html";
import adminNotifyTpl from "./admin-notification.html";

/* ── JWT 工具 ── */

function base64UrlEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

async function hmacSha256(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64UrlEncode(sig);
}

interface JwtPayload {
  sub: string;    // userId
  username: string;
  iat: number;
  exp: number;
}

async function signJwt(payload: Omit<JwtPayload, "iat" | "exp">, secret: string, expiresInSec = 604800): Promise<string> {
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const now = Math.floor(Date.now() / 1000);
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    ...payload, iat: now, exp: now + expiresInSec,
  })));
  const sig = await hmacSha256(secret, `${header}.${body}`);
  return `${header}.${body}.${sig}`;
}

async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const sig = await hmacSha256(secret, `${parts[0]}.${parts[1]}`);
  if (sig !== parts[2]) return null;
  try {
    const payload: JwtPayload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

/* ── 工具函数 ── */

function sanitize(user: { id: number; username: string; nickname?: string; avatar?: string; email?: string | null }): Record<string, unknown> {
  return { id: user.id, username: user.username, nickname: user.nickname ?? null, avatar: user.avatar ?? null, email: user.email ?? null };
}

/** 将 DB 蛇形字段转为驼峰（供前端消费） */
function formatUser(row: Record<string, unknown>): Record<string, unknown> {
  const map: Record<string, string> = {
    create_time: "createTime",
    update_time: "updateTime",
    login_time: "loginTime",
  };
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    out[map[key] || key] = val;
  }
  return out;
}

/** 发送邮件（未指定 to 则发给管理员） */
async function sendEmail(env: Env, to: string, subject: string, text: string, html?: string) {
  const fromAddr = env.NOTIFY_FROM_ADDRESS;
  const fromName = env.EMAIL_FROM_NAME;
  if (!fromAddr || !fromName) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${fromName} <${fromAddr}>`,
      to: [to],
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  }).catch(() => {});
}

/* ── Handler ── */

export async function handleAuth(request: Request, env: Env, origin: string | null) {
  const url = new URL(request.url);
  const method = request.method;

  try {
    // ── POST /api/auth/login ──
    if (method === "POST" && url.pathname === "/api/auth/login") {
      console.log("用户登录", { module: "auth", action: "login" });
      const { username, password } = await request.json() as { username: string; password: string };
      if (!username || !password) {
        return respond(null, "用户名或密码不能为空", 0, origin);
      }

      // 确保 email 列存在（幂等），以支持邮箱登录
      await env.DB.prepare("ALTER TABLE user ADD COLUMN email TEXT").run().catch(() => {});

      const row = await env.DB.prepare(
        "SELECT * FROM user WHERE (username = ? OR email = ?) AND deleted = 0"
      ).bind(username, username).first<{ id: number; username: string; nickname: string; avatar?: string; email?: string | null; password: string }>();

      if (!row || !bcrypt.compareSync(password, row.password)) {
        return respond(null, "用户名或密码错误", 0, origin);
      }

      // 记录登录时间
      await env.DB.prepare(
        "UPDATE user SET login_time = datetime('now') WHERE id = ?"
      ).bind(row.id).run();

      const token = await signJwt({ sub: String(row.id), username: row.username }, env.JWT_SECRET);
      return respond({ token, user: sanitize(row) }, "登录成功", 1, origin);
    }

    // ── POST /api/auth/register ──
    if (method === "POST" && url.pathname === "/api/auth/register") {
      console.log("用户注册", { module: "auth", action: "register" });

      // 确保 email 列存在（幂等）
      await env.DB.prepare("ALTER TABLE user ADD COLUMN email TEXT").run().catch(() => {});

      const { username, password, nickname, avatar, email } = await request.json() as {
        username: string; password: string; nickname?: string; avatar?: string; email?: string;
      };
      if (!username || !password) {
        return respond(null, "用户名和密码不能为空", 0, origin);
      }
      if (username.length < 2 || username.length > 64) {
        return respond(null, "用户名长度需在2-64之间", 0, origin);
      }
      if (password.length < 6 || password.length > 128) {
        return respond(null, "密码长度需在6-128之间", 0, origin);
      }

      // 校验邮箱格式（如果提供）
      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return respond(null, "邮箱格式不正确", 0, origin);
        }
        // 查重邮箱
        const emailExist = await env.DB.prepare(
          "SELECT id FROM user WHERE email = ? AND deleted = 0 AND email IS NOT NULL"
        ).bind(email).first();
        if (emailExist) {
          return respond(null, "邮箱已被注册", 0, origin);
        }
      }

      const exist = await env.DB.prepare(
        "SELECT id FROM user WHERE username = ? AND deleted = 0"
      ).bind(username).first();
      if (exist) {
        return respond(null, "用户名已存在", 0, origin);
      }

      const hash = bcrypt.hashSync(password, 10);
      const result = await env.DB.prepare(
        "INSERT INTO user (username, password, nickname, avatar, email) VALUES (?, ?, ?, ?, ?)"
      ).bind(username, hash, nickname ?? null, avatar ?? null, email ?? null).run();

      const user = { id: Number(result.meta.last_row_id), username, nickname: nickname ?? null, avatar: avatar ?? null, email: email ?? null };
      const token = await signJwt({ sub: String(user.id), username: user.username }, env.JWT_SECRET);

      // 发送通知（不阻塞响应）
      if (email) {
        const now = new Date().toISOString().replace("T", " ").slice(0, 19);
        await sendEmail(env, env.NOTIFY_TO_ADDRESS || "", "栏轩阁 - 新用户注册",
          `新用户注册：${username}\n邮箱：${email}`,
          adminNotifyTpl
            .replace(/\{\{TYPE\}\}/g, "新用户注册")
            .replace(/\{\{USERNAME\}\}/g, username)
            .replace(/\{\{EMAIL\}\}/g, email)
            .replace(/\{\{TIME\}\}/g, now));
        await sendEmail(env, email, "欢迎注册栏轩阁", `欢迎注册栏轩阁，你的账号「${username}」已创建成功。`, welcomeTpl.replace(/\{\{USERNAME\}\}/g, username));
      }

      return respond({ token, user: sanitize(user) }, "注册成功", 1, origin);
    }

    // ── GET /api/auth/github — 返回 GitHub OAuth 地址 ──
    if (method === "GET" && url.pathname === "/api/auth/github") {
      const ghUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${env.GITHUB_REDIRECT_URI}&scope=user:email`;
      return respond({ url: ghUrl }, "ok", 1, origin);
    }

    // ── GET /api/auth/github/callback — GitHub OAuth 回调 ──
    if (method === "GET" && url.pathname === "/api/auth/github/callback") {
      const code = url.searchParams.get("code");
      if (!code) return respond(null, "缺少 code 参数", 0, origin);
      console.log("GitHub OAuth 回调", { module: "auth", action: "github_callback" });

      // 1. exchange code for access_token
      const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "blog-api/1.0" },
        body: new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET ?? "", code, redirect_uri: env.GITHUB_REDIRECT_URI ?? "" }),
      });
      const tokenJson = await tokenResp.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
      if (!tokenJson.access_token) return respond(null, tokenJson.error_description || "GitHub 授权失败", 0, origin);

      // 2. 计算 token 过期时间（存时间戳方便判断）
      const tokenExpiresAt = tokenJson.expires_in ? String(Date.now() + tokenJson.expires_in * 1000) : null;

      // 获取 GitHub 用户信息
      const userResp = await fetch("https://api.github.com/user", {
        headers: { "Authorization": `Bearer ${tokenJson.access_token}`, "Accept": "application/json", "User-Agent": "blog-api/1.0" },
      });
      const ghUser = await userResp.json() as { id: number; login: string; avatar_url?: string; email?: string };

      // 如果公开邮箱为空，尝试获取主邮箱
      let ghEmail = ghUser.email;
      if (!ghEmail) {
        try {
          const emailsResp = await fetch("https://api.github.com/user/emails", {
            headers: { "Authorization": `Bearer ${tokenJson.access_token}`, "Accept": "application/json", "User-Agent": "blog-api/1.0" },
          });
          const emails = await emailsResp.json() as { email: string; primary: boolean }[];
          const primary = emails.find((e) => e.primary);
          if (primary) ghEmail = primary.email;
        } catch { /* 获取邮箱失败不影响登录 */ }
      }

      // 3. 确保 token 列存在
      for (const col of ["github_token", "github_refresh_token", "github_token_expires_at"]) {
        await env.DB.prepare(`ALTER TABLE user ADD COLUMN ${col} TEXT`).run().catch(() => {});
      }

      // 确保 email 列存在
      await env.DB.prepare("ALTER TABLE user ADD COLUMN email TEXT").run().catch(() => {});

      // 4. 查找或创建用户
      const ghAvatar = ghUser.avatar_url ?? null;
      let row = await env.DB.prepare(
        "SELECT id, username, nickname, avatar FROM user WHERE github_id = ? AND deleted = 0"
      ).bind(String(ghUser.id)).first<{ id: number; username: string; nickname: string; avatar?: string }>();

      if (!row) {
        const username = `gh_${ghUser.login}`;
        const result = await env.DB.prepare(
          "INSERT INTO user (username, password, nickname, github_id, avatar, email, github_token, github_refresh_token, github_token_expires_at) VALUES (?, '', ?, ?, ?, ?, ?, ?, ?)"
        ).bind(username, ghUser.login, String(ghUser.id), ghAvatar, ghEmail, tokenJson.access_token, tokenJson.refresh_token || null, tokenExpiresAt).run();
        row = { id: Number(result.meta.last_row_id), username, nickname: ghUser.login, avatar: ghAvatar };
      } else {
        await env.DB.prepare(
          "UPDATE user SET nickname = ?, avatar = ?, email = ?, github_token = ?, github_refresh_token = ?, github_token_expires_at = ?, update_time = datetime('now') WHERE id = ?"
        ).bind(ghUser.login, ghAvatar, ghEmail, tokenJson.access_token, tokenJson.refresh_token || null, tokenExpiresAt, row.id).run();
        row.nickname = ghUser.login;
        row.avatar = ghAvatar;
      }

      const token = await signJwt({ sub: String(row.id), username: row.username }, env.JWT_SECRET);
      // 记录登录时间
      await env.DB.prepare(
        "UPDATE user SET login_time = datetime('now') WHERE id = ?"
      ).bind(row.id).run();
      const frontendUrl = env.FRONTEND_URL || "https://www.lxpavilion.top";
      return Response.redirect(`${frontendUrl}/auth/callback?token=${token}`, 302);
    }

    // ── GET /api/auth/me ──
    if (method === "GET" && url.pathname === "/api/auth/me") {
      const auth = request.headers.get("Authorization");
      if (!auth?.startsWith("Bearer ")) {
        return respond(null, "未登录", 0, origin);
      }
      const payload = await verifyJwt(auth.slice(7), env.JWT_SECRET);
      if (!payload) {
        return respond(null, "token 无效或已过期", 0, origin);
      }
      const row = await env.DB.prepare(
        "SELECT id, username, nickname, avatar, email, create_time, update_time, login_time FROM user WHERE id = ? AND deleted = 0"
      ).bind(Number(payload.sub)).first<{ id: number; username: string; nickname: string; avatar?: string; email?: string | null; create_time?: string; update_time?: string; login_time?: string }>();
      if (!row) {
        return respond(null, "用户不存在", 0, origin);
      }
      return respond(formatUser(row as Record<string, unknown>), "ok", 1, origin);
    }

    // ── PUT /api/auth/profile — 更新个人资料 ──
    if (method === "PUT" && url.pathname === "/api/auth/profile") {
      const auth = request.headers.get("Authorization");
      if (!auth?.startsWith("Bearer ")) {
        return respond(null, "未登录", 0, origin);
      }
      const payload = await verifyJwt(auth.slice(7), env.JWT_SECRET);
      if (!payload) {
        return respond(null, "token 无效或已过期", 0, origin);
      }

      const { nickname, email } = await request.json() as { nickname?: string; email?: string };
      const updates: string[] = [];
      const values: (string | null)[] = [];

      if (nickname !== undefined) {
        updates.push("nickname = ?");
        values.push(nickname || null);
      }
      if (email !== undefined) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return respond(null, "邮箱格式不正确", 0, origin);
        }
        const emailExist = await env.DB.prepare(
          "SELECT id FROM user WHERE email = ? AND deleted = 0 AND id != ? AND email IS NOT NULL"
        ).bind(email, Number(payload.sub)).first();
        if (emailExist) {
          return respond(null, "邮箱已被其他账号使用", 0, origin);
        }
        updates.push("email = ?");
        values.push(email);
      }

      if (updates.length === 0) {
        return respond(null, "没有需要更新的字段", 0, origin);
      }

      updates.push("update_time = datetime('now')");
      values.push(String(Number(payload.sub)));

      await env.DB.prepare(
        `UPDATE user SET ${updates.join(", ")} WHERE id = ? AND deleted = 0`
      ).bind(...values).run();

      const row = await env.DB.prepare(
        "SELECT id, username, nickname, avatar, email, create_time, update_time, login_time FROM user WHERE id = ? AND deleted = 0"
      ).bind(Number(payload.sub)).first<{ id: number; username: string; nickname: string; avatar?: string; email?: string | null; create_time?: string; update_time?: string; login_time?: string }>();

      return respond(formatUser(row as Record<string, unknown>), "更新成功", 1, origin);
    }

    // ── PUT /api/auth/password — 修改密码 ──
    if (method === "PUT" && url.pathname === "/api/auth/password") {
      const auth = request.headers.get("Authorization");
      if (!auth?.startsWith("Bearer ")) {
        return respond(null, "未登录", 0, origin);
      }
      const payload = await verifyJwt(auth.slice(7), env.JWT_SECRET);
      if (!payload) {
        return respond(null, "token 无效或已过期", 0, origin);
      }

      const { oldPassword, newPassword } = await request.json() as { oldPassword: string; newPassword: string };
      if (!oldPassword || !newPassword) {
        return respond(null, "旧密码和新密码不能为空", 0, origin);
      }
      if (newPassword.length < 6 || newPassword.length > 128) {
        return respond(null, "新密码长度需在6-128之间", 0, origin);
      }

      const row = await env.DB.prepare(
        "SELECT password FROM user WHERE id = ? AND deleted = 0"
      ).bind(Number(payload.sub)).first<{ password: string }>();

      if (!row) {
        return respond(null, "用户不存在", 0, origin);
      }

      // GitHub 账号没有密码
      if (!row.password) {
        return respond(null, "GitHub 账号请通过 GitHub 登录", 0, origin);
      }

      if (!bcrypt.compareSync(oldPassword, row.password)) {
        return respond(null, "旧密码错误", 0, origin);
      }

      const hash = bcrypt.hashSync(newPassword, 10);
      await env.DB.prepare(
        "UPDATE user SET password = ?, update_time = datetime('now') WHERE id = ? AND deleted = 0"
      ).bind(hash, Number(payload.sub)).run();

      return respond(null, "密码修改成功", 1, origin);
    }

    // ── POST /api/auth/delete-account — 注销账号（软删除） ──
    if (method === "POST" && url.pathname === "/api/auth/delete-account") {
      const auth = request.headers.get("Authorization");
      if (!auth?.startsWith("Bearer ")) {
        return respond(null, "未登录", 0, origin);
      }
      const payload = await verifyJwt(auth.slice(7), env.JWT_SECRET);
      if (!payload) {
        return respond(null, "token 无效或已过期", 0, origin);
      }

      const user = await env.DB.prepare(
        "SELECT username, email FROM user WHERE id = ? AND deleted = 0"
      ).bind(Number(payload.sub)).first<{ username: string; email?: string }>();

      await env.DB.prepare(
        "DELETE FROM user WHERE id = ?"
      ).bind(Number(payload.sub)).run();

      if (user) {
        const now = new Date().toISOString().replace("T", " ").slice(0, 19);
        await sendEmail(env, env.NOTIFY_TO_ADDRESS || "", "栏轩阁 - 用户注销",
          `用户注销：${user.username}${user.email ? `\n邮箱：${user.email}` : ""}`,
          adminNotifyTpl
            .replace(/\{\{TYPE\}\}/g, "用户注销")
            .replace(/\{\{USERNAME\}\}/g, user.username)
            .replace(/\{\{EMAIL\}\}/g, user.email || "-")
            .replace(/\{\{TIME\}\}/g, now));
        if (user.email) {
          await sendEmail(env, user.email, "栏轩阁 - 账号已注销", `你的栏轩阁账号「${user.username}」已注销。`, deletedTpl.replace(/\{\{USERNAME\}\}/g, user.username));
        }
      }

      return respond(null, "账号已注销", 1, origin);
    }

    // ── POST /api/auth/forgot — 发送重置验证码 ──
    if (method === "POST" && url.pathname === "/api/auth/forgot") {
      console.log("发送重置验证码", { module: "auth", action: "forgot" });
      const { email } = await request.json() as { email: string };
      if (!email) {
        return respond(null, "邮箱不能为空", 0, origin);
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return respond(null, "邮箱格式不正确", 0, origin);
      }

      await env.DB.prepare("ALTER TABLE user ADD COLUMN email TEXT").run().catch(() => {});

      const user = await env.DB.prepare(
        "SELECT id, username FROM user WHERE email = ? AND deleted = 0"
      ).bind(email).first<{ id: number; username: string }>();
      if (!user) {
        return respond(null, "该邮箱未注册", 0, origin);
      }

      // 生成 6 位验证码
      const code = String(Math.floor(100000 + Math.random() * 900000));
      // bcrypt 加密验证码，返回给前端存储
      const hash = bcrypt.hashSync(code, 10);

      // 通过 sendNotify 发送邮件（同步等待结果用于错误处理）
      const fromName = env.EMAIL_FROM_NAME;
      const fromAddr = env.NOTIFY_FROM_ADDRESS;
      if (!fromName || !fromAddr) {
        return respond(null, "邮件服务未配置", 0, origin);
      }
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${fromName} <${fromAddr}>`,
            to: [email],
            subject: "「栏轩阁」密码重置验证码",
            html: resetCodeTpl.replace(/\{\{CODE\}\}/g, code).replace(/\{\{USERNAME\}\}/g, user!.username),
          }),
        });
        const data = await res.json() as { message?: string };
        if (!res.ok) {
          return respond(null, `发送失败: ${data.message || "未知错误"}`, 0, origin);
        }
      } catch (err) {
        return respond(null, `发送失败: ${String(err)}`, 0, origin);
      }

      return respond({ hash, username: user!.username }, "验证码已发送", 1, origin);
    }

    // ── POST /api/auth/reset — 验证码校验 + 重置密码 ──
    if (method === "POST" && url.pathname === "/api/auth/reset") {
      console.log("重置密码", { module: "auth", action: "reset" });
      const { email, code, hash, password } = await request.json() as {
        email: string; code: string; hash: string; password: string;
      };
      if (!email || !code || !hash || !password) {
        return respond(null, "参数不完整", 0, origin);
      }
      if (password.length < 6 || password.length > 128) {
        return respond(null, "密码长度需在6-128之间", 0, origin);
      }

      // 比对验证码
      if (!bcrypt.compareSync(code, hash)) {
        return respond(null, "验证码错误", 0, origin);
      }

      // 更新密码
      const newHash = bcrypt.hashSync(password, 10);
      const result = await env.DB.prepare(
        "UPDATE user SET password = ?, update_time = datetime('now') WHERE email = ? AND deleted = 0"
      ).bind(newHash, email).run();

      if (result.meta.changes === 0) {
        return respond(null, "该邮箱未注册", 0, origin);
      }

      return respond(null, "密码重置成功", 1, origin);
    }

    return respond(null, "Not Found", 0, origin);
  } catch (e: any) {
    console.error("认证接口异常", { module: "auth", action: "handler_error", method, path: url.pathname, error: e.message });
    return respond({ error: e.message }, "服务器错误", 0, origin);
  }
}
