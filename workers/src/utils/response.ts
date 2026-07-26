import type { Env, ApiResponse } from "../types";

/**
 * 生成 CORS 响应头。
 * 若 origin 为 falsy 则回退到 "*"。
 */
export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Guest-Session",
  };
}

/**
 * 统一的 JSON 响应包装。
 * code === 1 → 200；其它 → 500。
 */
export function respond<T>(
  data: T,
  msg = "ok",
  code = 1,
  origin: string | null = "*"
): Response {
  const body: ApiResponse<T> = { code, data, msg };
  return new Response(JSON.stringify(body), {
    status: code === 1 ? 200 : 500,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

/**
 * 创建可写入缓存的 Response 副本（带 Cache-Control）。
 */
export function cacheableResponse<T>(
  data: T,
  origin: string | null,
  maxAge = 3600
): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=0, s-maxage=${maxAge}`,
      ...corsHeaders(origin),
    },
  });
}

/**
 * 管理接口 Token 校验。
 * Authorization 头不等于 Bearer <ADMIN_TOKEN> 则返回 401 Response，否则返回 null。
 */
export function requireAdmin(request: Request, env: Env): Response | null {
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response(JSON.stringify({ code: 0, data: null, msg: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders(request.headers.get("Origin")) },
    });
  }
  return null;
}
