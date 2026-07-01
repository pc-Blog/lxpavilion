// ── 环境变量 ──

export interface Env {
  AI: Ai;
  DB: D1Database;
  JWT_SECRET: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_REDIRECT_URI?: string;
  FRONTEND_URL?: string;
  CF_API_TOKEN: string;
  CF_ZONE_ID: string;
  CSDN_USER?: string;
  JUEJIN_USER_ID?: string;
  CNBLOGS_BLOGAPP?: string;

  // 邮件转发目标（环境变量，运行时只读）
  FORWARD_EMAIL?: string;

  // MailerLite 邮件订阅
  MAILERLITE_API_KEY: string;
  RSS_MAX_ARTICLES?: string;
  HOT_MAX_ARTICLES?: string;

  // GitHub App 评论系统
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_INSTALLATION_ID: string;
  GITHUB_REPO_OWNER: string;
  GITHUB_REPO_NAME: string;
  GITHUB_DISCUSSION_CATEGORY_ID: string;
}

// ── API 统一响应格式 ──

export interface ApiResponse<T = unknown> {
  code: number;
  data: T | null;
  msg: string;
}

// ── 分析数据 ──

export interface DailyStats {
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

export interface HourlyStats {
  datetime: string;
  requests: number;
  uniqueVisitors: number;
  pageViews: number;
  cachedRequests: number;
  cacheHitRate: number;
  bandwidthBytes: number;
  bandwidthMB: number;
}

export interface Totals {
  requests: number;
  uniqueVisitors: number;
  pageViews: number;
  cacheHitRate: number;
  cacheHitRateBytes: number;
  bandwidthMB: number;
}

export interface BreakdownItem {
  name: string;
  value: number;
  pct: number;
}

export interface AnalyticsResult {
  daily: DailyStats[];
  hourly: HourlyStats[];
  totals: Totals;
  byCountry: BreakdownItem[];
  byDevice: BreakdownItem[];
  byBrowser: BreakdownItem[];
  byOS: BreakdownItem[];
  byCacheStatus: BreakdownItem[];
  byHTTPProtocol: BreakdownItem[];
  generatedAt: string;
  _cache: "hit" | "miss";
  _cachedAt?: string;
}

// ── 多平台统计 ──

export interface PlatformArticle {
  platform: string;
  title: string;
  url: string;
  date: string;
  views: number;
  likes: number;
  comments?: number;
}

export interface CSDNData {
  articleCount: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalCollects: number;
  articles: PlatformArticle[];
}

export interface JuejinData {
  articleCount: number;
  totalViews: number;
  totalLikes: number;
  totalCollects: number;
  followers: number;
  articles: PlatformArticle[];
}

export interface CnblogsData {
  articleCount: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  articles: PlatformArticle[];
}

export interface PlatformEntry {
  views: number;
  likes: number;
  url: string;
}

export interface MergedArticle {
  title: string;
  date: string;
  csdn: PlatformEntry | null;
  juejin: PlatformEntry | null;
  cnblogs: PlatformEntry | null;
}

export interface PlatformSummary {
  csdn: Pick<CSDNData, "totalViews" | "totalLikes" | "articleCount" | "totalComments" | "totalCollects"> | null;
  juejin: Pick<JuejinData, "totalViews" | "totalLikes" | "articleCount" | "totalCollects" | "followers"> | null;
  cnblogs: Pick<CnblogsData, "totalViews" | "totalLikes" | "articleCount" | "totalComments"> | null;
  mergedArticles: MergedArticle[];
  generatedAt: string;
}

// ── 原始 GraphQL 响应（宽松类型，Cloudflare 未公开完整 schema） ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawGraphQLResponse = Record<string, any>;

// ── 合并结果中的平台映射 ──

export interface ArticleMap {
  [title: string]: {
    date: string;
    csdn?: PlatformEntry;
    juejin?: PlatformEntry;
    cnblogs?: PlatformEntry;
  };
}
