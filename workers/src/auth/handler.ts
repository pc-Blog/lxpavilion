import { respond } from "../utils/response";
import type { Env } from "../types";
import bcrypt from "bcryptjs";

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

function sanitize(user: { id: number; username: string; nickname?: string; avatar?: string }): Record<string, unknown> {
  return { id: user.id, username: user.username, nickname: user.nickname ?? null, avatar: user.avatar ?? null };
}

/* ── Handler ── */

export async function handleAuth(request: Request, env: Env, origin: string | null) {
  const url = new URL(request.url);
  const method = request.method;

  try {
    // ── POST /api/auth/login ──
    if (method === "POST" && url.pathname === "/api/auth/login") {
      const { username, password } = await request.json() as { username: string; password: string };
      if (!username || !password) {
        return respond(null, "用户名或密码不能为空", 0, origin);
      }

      const row = await env.DB.prepare(
        "SELECT * FROM user WHERE username = ? AND deleted = 0"
      ).bind(username).first<{ id: number; username: string; nickname: string; avatar?: string; password: string }>();

      if (!row || !bcrypt.compareSync(password, row.password)) {
        return respond(null, "用户名或密码错误", 0, origin);
      }

      const token = await signJwt({ sub: String(row.id), username: row.username }, env.JWT_SECRET);
      return respond({ token, user: sanitize(row) }, "登录成功", 1, origin);
    }

    // ── POST /api/auth/register ──
    if (method === "POST" && url.pathname === "/api/auth/register") {
      const { username, password, nickname, avatar } = await request.json() as {
        username: string; password: string; nickname?: string; avatar?: string;
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

      const exist = await env.DB.prepare(
        "SELECT id FROM user WHERE username = ? AND deleted = 0"
      ).bind(username).first();
      if (exist) {
        return respond(null, "用户名已存在", 0, origin);
      }

      const hash = bcrypt.hashSync(password, 10);
      const result = await env.DB.prepare(
        "INSERT INTO user (username, password, nickname, avatar) VALUES (?, ?, ?, ?)"
      ).bind(username, hash, nickname ?? null, avatar ?? null).run();

      const user = { id: Number(result.meta.last_row_id), username, nickname: nickname ?? null, avatar: avatar ?? null };
      const token = await signJwt({ sub: String(user.id), username: user.username }, env.JWT_SECRET);
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

      // 3. 确保 token 列存在
      for (const col of ["github_token", "github_refresh_token", "github_token_expires_at"]) {
        await env.DB.prepare(`ALTER TABLE user ADD COLUMN ${col} TEXT`).run().catch(() => {});
      }

      // 4. 查找或创建用户
      const ghAvatar = ghUser.avatar_url ?? null;
      let row = await env.DB.prepare(
        "SELECT id, username, nickname, avatar FROM user WHERE github_id = ? AND deleted = 0"
      ).bind(String(ghUser.id)).first<{ id: number; username: string; nickname: string; avatar?: string }>();

      if (!row) {
        const username = `gh_${ghUser.login}`;
        const result = await env.DB.prepare(
          "INSERT INTO user (username, password, nickname, github_id, avatar, github_token, github_refresh_token, github_token_expires_at) VALUES (?, '', ?, ?, ?, ?, ?, ?)"
        ).bind(username, ghUser.login, String(ghUser.id), ghAvatar, tokenJson.access_token, tokenJson.refresh_token || null, tokenExpiresAt).run();
        row = { id: Number(result.meta.last_row_id), username, nickname: ghUser.login, avatar: ghAvatar };
      } else {
        await env.DB.prepare(
          "UPDATE user SET nickname = ?, avatar = ?, github_token = ?, github_refresh_token = ?, github_token_expires_at = ?, update_time = datetime('now') WHERE id = ?"
        ).bind(ghUser.login, ghAvatar, tokenJson.access_token, tokenJson.refresh_token || null, tokenExpiresAt, row.id).run();
        row.nickname = ghUser.login;
        row.avatar = ghAvatar;
      }

      const token = await signJwt({ sub: String(row.id), username: row.username }, env.JWT_SECRET);
      // 4. 重定向到前端
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
        "SELECT id, username, nickname, avatar FROM user WHERE id = ? AND deleted = 0"
      ).bind(Number(payload.sub)).first<{ id: number; username: string; nickname: string; avatar?: string }>();
      if (!row) {
        return respond(null, "用户不存在", 0, origin);
      }
      return respond(row, "ok", 1, origin);
    }

    return respond(null, "Not Found", 0, origin);
  } catch (e: any) {
    return respond({ error: e.message }, "服务器错误", 0, origin);
  }
}
