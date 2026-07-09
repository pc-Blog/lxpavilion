export interface Category {
  id: number;
  name: string;
  type: string;
}

export interface Tag {
  id: number;
  name: string;
}

export interface ArticleSaveRequest {
  id?: number;
  title: string;
  summary?: string;
  content: string;
  coverImage?: string;
  categoryId: number;
  tagIds: number[];
  isPublished: number;
}

interface ApiResult<T> {
  code: number;
  msg: string;
  data: T;
}

interface PageVO<T> {
  total: number;
  rows: T[];
}

// article_id JWT 式编码（payload + 签名）
function signArticleId(id: number): string {
  let h = (id * 2654435761 + 987654321) >>> 0;
  h = ((h ^ (h >>> 16)) * 0x85ebca6b) >>> 0;
  h = ((h ^ (h >>> 13)) * 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h.toString(36);
}

export function encodeArticleId(id: number): string {
  return "a_" + id.toString(36) + "." + signArticleId(id);
}

export function decodeArticleId(raw: unknown): number | undefined {
  if (!raw || typeof raw !== "string" || !raw.startsWith("a_")) return undefined;
  const dot = raw.indexOf(".");
  if (dot === -1) return undefined;
  try {
    const id = parseInt(raw.slice(2, dot), 36);
    const sig = raw.slice(dot + 1);
    if (isNaN(id) || sig !== signArticleId(id)) return undefined;
    return id;
  } catch {
    return undefined;
  }
}

/**
 * 移除 YAML frontmatter 块，只保留正文
 */
export function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n*/);
  return match ? content.slice(match[0].length) : content;
}

export class ApiClient {
  constructor(private baseUrl: string) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {};
    if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
    const res = await fetch(url, {
      method,
      headers,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    const json: ApiResult<T> = await res.json();
    if (json.code !== 1) throw new Error(json.msg || "请求失败");
    return json.data;
  }

  async fetchCategories(): Promise<Category[]> {
    const data = await this.request<PageVO<Category>>("POST", "/category/page", { pageNum: 1, pageSize: 999 });
    return data.rows.filter((c) => c.type === "ARTICLE");
  }

  async fetchTags(): Promise<Tag[]> {
    const data = await this.request<PageVO<Tag>>("POST", "/tag/page", { pageNum: 1, pageSize: 999 });
    return data.rows;
  }

  async fetchArticles(keyword?: string, pageNum = 1, pageSize = 50): Promise<PageVO<{ id: number; title: string; categoryName: string; isPublished: number; createdAt: string }>> {
    return this.request("POST", "/article/page", { pageNum, pageSize, query: keyword ? { title: keyword } : undefined });
  }

  async uploadImage(file: File): Promise<Media> {
    const form = new FormData();
    form.append("file", file);
    return this.request<Media>("POST", "/media/upload", form);
  }

  async createCategory(name: string): Promise<Category> {
    return this.request<Category>("POST", "/category", { name, type: "ARTICLE" });
  }

  async createTag(name: string): Promise<Tag> {
    return this.request<Tag>("POST", "/tag", { name });
  }

  async createArticle(article: ArticleSaveRequest): Promise<{ id: number }> {
    return this.request("POST", "/article", article);
  }

  async getArticleDetail(id: number): Promise<{
    title: string;
    summary: string;
    content: string;
    coverImage: string;
    categoryId: number;
    categoryName: string;
    tags?: { id: number; name: string }[];
  }> {
    return this.request("GET", `/article/${id}`);
  }

  async updateArticle(article: ArticleSaveRequest): Promise<void> {
    await this.request("PUT", "/article", article);
  }
}
