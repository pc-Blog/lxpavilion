import type { ApiResponse } from "../types";

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
