/**
 * JWT 验证工具 — 给 comment handler 复用 auth handler 中的逻辑
 */

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

async function hmacSha256(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export interface JwtPayload {
  sub: string;
  username: string;
  github_token?: string;
  iat: number;
  exp: number;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const sig = await hmacSha256(secret, `${parts[0]}.${parts[1]}`);
  if (sig !== parts[2]) return null;
  try {
    const payload: JwtPayload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(parts[1])),
    );
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
