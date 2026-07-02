import type { RawGraphQLResponse } from "../types";
import type { Env } from "../types";

const CF_GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";

/**
 * 调用 Cloudflare GraphQL API。
 */
export async function callCF(
  query: string,
  env: Env
): Promise<RawGraphQLResponse> {
  console.log("Cloudflare GraphQL 请求", { module: "analytics", action: "graphql_request" });

  const resp = await fetch(CF_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  const json: RawGraphQLResponse = await resp.json();

  if (!resp.ok) {
    console.error("Cloudflare GraphQL HTTP 错误", { module: "analytics", action: "graphql_http_error", status: resp.status });
    throw new Error(
      `Cloudflare HTTP ${resp.status}: ${JSON.stringify(json)}`
    );
  }
  if (json.errors) {
    console.error("Cloudflare GraphQL 返回错误", { module: "analytics", action: "graphql_error", errors: json.errors });
    throw new Error(
      `Cloudflare GraphQL error: ${JSON.stringify(json.errors)}`
    );
  }

  console.log("Cloudflare GraphQL 成功", { module: "analytics", action: "graphql_success" });
  return json;
}
