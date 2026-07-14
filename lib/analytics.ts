// Cloudflare Analytics API — directly called from client side
// Token must be read-only (Analytics: Read) and stored in NEXT_PUBLIC_CF_*

export interface DailyData {
  date: string;
  requests: number;
  uniqueVisitors: number;
  pageViews: number;
  cachedRequests: number;
  cacheHitRate: number;
  cacheHitRateBytes: number;
  bandwidthBytes: number;
  bandwidthMB: number;
}

export interface HourlyData {
  datetime: string;
  requests: number;
  uniqueVisitors: number;
  pageViews: number;
  cachedRequests: number;
  cacheHitRate: number;
  bandwidthBytes: number;
  bandwidthMB: number;
}

export interface BreakdownItem {
  name: string;
  value: number;
  pct: number;
}

export interface AnalyticsData {
  daily: DailyData[];
  hourly: HourlyData[];
  totals: {
    requests: number;
    uniqueVisitors: number;
    pageViews: number;
    cacheHitRate: number;
    cacheHitRateBytes: number;
    bandwidthMB: number;
  };
  byCountry: BreakdownItem[];
  byDevice: BreakdownItem[];
  byBrowser: BreakdownItem[];
  byOS: BreakdownItem[];
  byCacheStatus: BreakdownItem[];
  byHTTPProtocol: BreakdownItem[];
  generatedAt: string;
}

import { siteConfig } from "./siteConfig";

const WORKER_URL = `https://${siteConfig.workerApi}`;

// ── Fetch all analytics data from Worker ──
export async function fetchAnalytics(days: number = 7): Promise<AnalyticsData> {
  const resp = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ days: Math.min(days, 364) }),
  });

  const json = await resp.json();

  if (json.code === 0) {
    throw new Error(json.msg || "API error");
  }

  return json.data;
}