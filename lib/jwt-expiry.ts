/**
 * JWT 过期时间工具（纯前端校验，用于登录态自愈）
 *
 * 说明：这里只解析 JWT payload 的 exp 字段做前端体验校验，
 * 安全性完全由服务端（Worker verifyJwt）保证。
 */

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

/** 返回 token 的过期时间戳（毫秒），无法解析时返回 null */
export function getTokenExpiryMs(token: string): number | null {
  const payload = decodePayload(token);
  const exp = payload?.exp;
  return typeof exp === "number" ? exp * 1000 : null;
}

/** token 是否已过期（无法解析时视为未过期，交由服务端判定） */
export function isTokenExpired(token: string): boolean {
  const exp = getTokenExpiryMs(token);
  return exp !== null && exp <= Date.now();
}