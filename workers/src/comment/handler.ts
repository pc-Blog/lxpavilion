/**
 * 评论系统 — 基于 GitHub Discussions
 *
 * 所有写操作需登录（JWT），Worker 用 GitHub App Installation Token 代写。
 * 用户无感知 GitHub，评论显示为 App 身份，用户信息嵌入评论 body。
 *
 * Emoji 反应、点赞存 D1（因 App Token 无法区分每个用户）。
 */

import { respond } from "../utils/response";
import { getInstallationToken } from "../utils/github-token";
import { verifyJwt } from "../utils/jwt";
import type { Env } from "../types";

/* ── 模块级初始化（Worker 冷启动时执行一次） ── */

let initPromise: Promise<void> | null = null;

async function initDb(db: D1Database) {
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS comment_reaction (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id TEXT NOT NULL, user_id INTEGER NOT NULL, reaction TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), UNIQUE(subject_id, user_id, reaction))"
  ).run();
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS comment_upvote (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id TEXT NOT NULL, user_id INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now')), UNIQUE(subject_id, user_id))"
  ).run();
  initPromise = null;
}

/* ── 常量 ── */

const GQL = "https://api.github.com/graphql";
const UA = "blog-worker/1.0";
const REPO_SEARCH = (owner: string, name: string) => `repo:${owner}/${name}`;

/** 8 种 GitHub 表情反应 */
const REACTIONS = [
  "THUMBS_UP", "THUMBS_DOWN", "LAUGH", "HOORAY",
  "CONFUSED", "HEART", "ROCKET", "EYES",
] as const;
type Reaction = (typeof REACTIONS)[number];

/* ── 用户信息嵌入/解析 ── */

function embedUser(body: string, userId: number, nickname: string, avatar?: string): string {
  return `<!--u:${userId}|${nickname}|${avatar || ""}-->\n${body}`;
}

interface EmbeddedUser {
  userId: number;
  nickname: string;
  avatar: string;
  cleanBody: string;
}

function parseUser(body: string): EmbeddedUser {
  // 登录用户: <!--u:userId|nickname|avatar-->
  const match = body.match(/^<!--u:(\d+)\|(.+?)\|(.*?)-->\n?/);
  if (match) {
    return {
      userId: Number(match[1]),
      nickname: match[2],
      avatar: match[3],
      cleanBody: body.slice(match[0].length),
    };
  }
  // 游客: <!--guest:sessionId|nickname-->
  const guestMatch = body.match(/^<!--guest:([a-f0-9-]+)\|(.+?)-->\n?/);
  if (guestMatch) {
    return {
      userId: 0,
      nickname: guestMatch[2],
      avatar: "",
      cleanBody: body.slice(guestMatch[0].length),
    };
  }
  return { userId: 0, nickname: "Anonymous", avatar: "", cleanBody: body };
}

function extractGuestSession(body: string): string | null {
  const match = body.match(/^<!--guest:([a-f0-9-]+)\|/);
  return match ? match[1] : null;
}

/* ── GraphQL 执行 ── */

async function gql<T>(token: string, query: string, vars: Record<string, unknown>): Promise<T> {
  const resp = await fetch(GQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": UA,
    },
    body: JSON.stringify({ query, variables: vars }),
  });
  const json = (await resp.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data as T;
}

/* ── 批量查询评论数 ── */

const COUNTS_QUERY = `
  query($query: String!) {
    search(query: $query, type: DISCUSSION, first: 100) {
      nodes {
        ... on Discussion {
          title
          comments(first: 50) {
            nodes {
              id
              replies(first: 20) { nodes { id } }
            }
          }
        }
      }
    }
  }
`;

interface CommentNode {
  id: string;
  replies?: { nodes: Array<{ id: string }> };
}

interface CountsResult {
  search: {
    nodes: Array<{
      title: string;
      comments: { nodes: Array<CommentNode> };
    }>;
  };
}

/* ── 查询：搜索 Discussion ── */

const SEARCH_DISCUSSION = `
  query($query: String!) {
    search(query: $query, type: DISCUSSION, first: 1) {
      nodes {
        ... on Discussion {
          id
          title
          locked
          repository { nameWithOwner }
          comments(first: 100) {
            nodes {
              id
              body
              createdAt
              lastEditedAt
              deletedAt
              isMinimized
              author { login avatarUrl }
              replyTo { id }
              replies(first: 50) {
                nodes {
                  id
                  body
                  createdAt
                  lastEditedAt
                  deletedAt
                  isMinimized
                  author { login avatarUrl }
                }
              }
            }
          }
        }
      }
    }
  }
`;

/* ── 统计评论数 ── */

const STATS_QUERY = `
  query($owner: String!, $name: String!, $categoryId: ID!) {
    repository(owner: $owner, name: $name) {
      discussions(first: 50, categoryId: $categoryId) {
        totalCount
        nodes {
          comments(first: 50) {
            nodes {
              id
              replies(first: 20) { nodes { id } }
            }
          }
        }
      }
    }
  }
`;

interface StatsNode {
  comments: { nodes: Array<CommentNode> };
}

interface StatsResult {
  repository: {
    discussions: {
      totalCount: number;
      nodes: Array<StatsNode>;
    };
  };
}

interface SearchResult {
  search: {
    nodes: Array<{
      id: string;
      title: string;
      locked: boolean;
      repository: { nameWithOwner: string };
      comments: {
        nodes: Array<GqlComment>;
      };
    }>;
  };
}

/* ── 创建 Discussion ── */

const CREATE_DISCUSSION = `
  mutation($repoId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
    createDiscussion(input: {
      repositoryId: $repoId,
      categoryId: $categoryId,
      title: $title,
      body: $body
    }) {
      discussion { id }
    }
  }
`;

interface CreateResult {
  createDiscussion: {
    discussion: { id: string };
  };
}

/* ── 添加评论 ── */

const ADD_COMMENT = `
  mutation($discussionId: ID!, $body: String!, $replyToId: ID) {
    addDiscussionComment(input: { discussionId: $discussionId, body: $body, replyToId: $replyToId }) {
      comment {
        id
        body
        createdAt
        lastEditedAt
        author { login }
        replyTo { id }
      }
    }
  }
`;

interface AddCommentResult {
  addDiscussionComment: {
    comment: GqlComment;
  };
}

/* ── 编辑评论 ── */

const UPDATE_COMMENT = `
  mutation($commentId: ID!, $body: String!) {
    updateDiscussionComment(input: { commentId: $commentId, body: $body }) {
      comment { id body lastEditedAt }
    }
  }
`;

/* ── 查询评论的回复 ── */

const GET_REPLIES = `
  query($id: ID!) {
    node(id: $id) {
      ... on DiscussionComment {
        replies(first: 100) {
          nodes { id }
        }
      }
    }
  }
`;

async function getReplyIds(token: string, commentId: string): Promise<string[]> {
  try {
    const data = await gql<{ node: { replies: { nodes: Array<{ id: string }> } } }>(token, GET_REPLIES, { id: commentId });
    return data.node?.replies?.nodes?.map((n) => n.id) || [];
  } catch {
    return [];
  }
}

/* ── 查询单条评论（用于所有权校验） ── */

const GET_COMMENT = `
  query($id: ID!) {
    node(id: $id) {
      ... on DiscussionComment {
        id
        body
        author { login }
      }
    }
  }
`;

interface CommentNode {
  id: string;
  body: string;
  author: { login: string };
}

async function checkOwnership(token: string, nodeId: string, userId: number, nickname: string): Promise<boolean> {
  try {
    const data = await gql<{ node: CommentNode }>(token, GET_COMMENT, { id: nodeId });
    const node = data.node;
    if (!node) return false;
    // 优先匹配 <!--u:userId|...-->
    const match = node.body.match(/^<!--u:(\d+)\|/);
    if (match) return Number(match[1]) === userId;
    // 没有则回退到 GitHub 登录名匹配
    return node.author?.login === nickname;
  } catch {
    return false;
  }
}

async function checkGuestOwnership(token: string, nodeId: string, guestSession: string): Promise<boolean> {
  try {
    const data = await gql<{ node: CommentNode }>(token, GET_COMMENT, { id: nodeId });
    return extractGuestSession(data.node?.body || "") === guestSession;
  } catch {
    return false;
  }
}

/* ── 删除评论 ── */

const DELETE_COMMENT = `
  mutation($commentId: ID!) {
    deleteDiscussionComment(input: { id: $commentId }) {
      clientMutationId
    }
  }
`;

/* ── GraphQL 类型 ── */

interface GqlComment {
  id: string;
  body: string;
  createdAt: string;
  lastEditedAt?: string;
  deletedAt?: string;
  isMinimized?: boolean;
  author: { login: string; avatarUrl?: string };
  replyTo?: { id: string };
  replies?: { nodes: GqlComment[] };
}

/* ── GitHub 用户 token 获取（含刷新） ── */

async function getUserToken(env: Env, userId: number): Promise<string | null> {
  const row = await env.DB.prepare(
    "SELECT github_token, github_refresh_token, github_token_expires_at FROM user WHERE id = ? AND deleted = 0"
  ).bind(userId).first<{ github_token: string; github_refresh_token: string; github_token_expires_at: string }>();

  if (!row?.github_token) return null;

  // 没有过期时间或未过期 → 直接用
  if (!row.github_token_expires_at || Date.now() < Number(row.github_token_expires_at)) {
    return row.github_token;
  }

  // 过期了，尝试刷新
  if (!row.github_refresh_token) return null;

  try {
    const resp = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "blog-worker/1.0" },
      body: new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID ?? "",
        client_secret: env.GITHUB_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: row.github_refresh_token,
      }),
    });
    const data = await resp.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!data.access_token) return null;

    const newExpiresAt = data.expires_in ? String(Date.now() + data.expires_in * 1000) : null;
    await env.DB.prepare(
      "UPDATE user SET github_token = ?, github_refresh_token = ?, github_token_expires_at = ? WHERE id = ?"
    ).bind(data.access_token, data.refresh_token || row.github_refresh_token, newExpiresAt, userId).run();
    return data.access_token;
  } catch {
    return null;
  }
}

/* ── 反应 + 点赞 工具 ── */

interface ReactionGroup {
  reaction: string;
  count: number;
  viewerHasReacted: boolean;
}

async function getReactions(
  db: D1Database,
  subjectIds: string[],
  userId?: number,
): Promise<Map<string, ReactionGroup[]>> {
  if (subjectIds.length === 0) return new Map();

  // 查所有反应的统计
  const placeholders = subjectIds.map(() => "?").join(",");
  const rows = await db
    .prepare(
      `SELECT subject_id, reaction, COUNT(*) as count
       FROM comment_reaction
       WHERE subject_id IN (${placeholders})
       GROUP BY subject_id, reaction`,
    )
    .bind(...subjectIds)
    .all<{ subject_id: string; reaction: string; count: number }>();

  // 查当前用户的反应（如果已登录）
  let userRows: Array<{ subject_id: string; reaction: string }> = [];
  if (userId) {
    userRows = (
      await db
        .prepare(
          `SELECT subject_id, reaction FROM comment_reaction
           WHERE subject_id IN (${placeholders}) AND user_id = ?`,
        )
        .bind(...subjectIds, userId)
        .all<{ subject_id: string; reaction: string }>()
    ).results;
  }

  const userReacted = new Map<string, Set<string>>();
  for (const r of userRows) {
    if (!userReacted.has(r.subject_id)) userReacted.set(r.subject_id, new Set());
    userReacted.get(r.subject_id)!.add(r.reaction);
  }

  // 组装每个 subject 的反应
  const grouped = new Map<string, Map<string, number>>();
  for (const r of rows.results) {
    if (!grouped.has(r.subject_id)) grouped.set(r.subject_id, new Map());
    grouped.get(r.subject_id)!.set(r.reaction, r.count);
  }

  const result = new Map<string, ReactionGroup[]>();
  for (const id of subjectIds) {
    const counts = grouped.get(id) || new Map();
    const userSet = userReacted.get(id) || new Set();
    result.set(
      id,
      REACTIONS.map((r) => ({
        reaction: r,
        count: counts.get(r) || 0,
        viewerHasReacted: userSet.has(r),
      })),
    );
  }

  return result;
}

/* ── 点赞查询 ── */

interface UpvoteData {
  upvoteCount: number;
  viewerHasUpvoted: boolean;
}

async function getUpvotes(
  db: D1Database,
  subjectIds: string[],
  userId?: number,
): Promise<Map<string, UpvoteData>> {
  if (subjectIds.length === 0) return new Map();

  const placeholders = subjectIds.map(() => "?").join(",");

  // 统计
  const counts = await db
    .prepare(
      `SELECT subject_id, COUNT(*) as count
       FROM comment_upvote
       WHERE subject_id IN (${placeholders})
       GROUP BY subject_id`,
    )
    .bind(...subjectIds)
    .all<{ subject_id: string; count: number }>();

  // 当前用户是否点过
  let userSet = new Set<string>();
  if (userId) {
    const userRows = await db
      .prepare(
        `SELECT subject_id FROM comment_upvote
         WHERE subject_id IN (${placeholders}) AND user_id = ?`,
      )
      .bind(...subjectIds, userId)
      .all<{ subject_id: string }>();
    userSet = new Set(userRows.results.map((r) => r.subject_id));
  }

  const countMap = new Map(counts.results.map((r) => [r.subject_id, r.count]));
  const result = new Map<string, UpvoteData>();
  for (const id of subjectIds) {
    result.set(id, {
      upvoteCount: countMap.get(id) || 0,
      viewerHasUpvoted: userSet.has(id),
    });
  }
  return result;
}

/* ── 构建评论树 + 附加数据 ── */

type ReactionMap = Map<string, ReactionGroup[]>;
type UpvoteMap = Map<string, UpvoteData>;

function buildCommentTree(
  nodes: GqlComment[],
  reactions: ReactionMap,
  upvotes: UpvoteMap,
  discussionReactions?: ReactionGroup[],
) {
  // 分离顶层评论和回复
  const topLevel: GqlComment[] = [];
  const replyMap = new Map<string, GqlComment[]>();

  for (const c of nodes) {
    if (c.replyTo?.id) {
      if (!replyMap.has(c.replyTo.id)) replyMap.set(c.replyTo.id, []);
      replyMap.get(c.replyTo.id)!.push(c);
    } else {
      topLevel.push(c);
    }
  }

  const toVo = (c: GqlComment): CommentVO => {
    const u = parseUser(c.body || "");
    const uv = upvotes.get(c.id) || { upvoteCount: 0, viewerHasUpvoted: false };
    const author = { id: u.userId, nickname: u.nickname, avatar: u.avatar || "" };
    return {
      nodeId: c.id,
      content: u.cleanBody,
      author,
      createdAt: c.createdAt,
      lastEditedAt: c.lastEditedAt || null,
      deletedAt: c.deletedAt || null,
      replyToId: c.replyTo?.id || null,
      reactions: reactions.get(c.id) || [],
      upvoteCount: uv.upvoteCount,
      viewerHasUpvoted: uv.viewerHasUpvoted,
      replies: (replyMap.get(c.id) || c.replies?.nodes || []).map(toVo),
    };
  };

  return {
    topLevel: topLevel.map(toVo),
    discussionReactions: discussionReactions || [],
  };
}

/* ── API 响应类型 ── */

interface AuthorVO {
  id: number;
  nickname: string;
  avatar: string;
}

interface CommentVO {
  nodeId: string;
  content: string;
  author: AuthorVO;
  createdAt: string;
  lastEditedAt: string | null;
  deletedAt: string | null;
  replyToId: string | null;
  reactions: ReactionGroup[];
  upvoteCount: number;
  viewerHasUpvoted: boolean;
  replies: CommentVO[];
}

/* ── Handler ── */

export async function handleComment(request: Request, env: Env, origin: string | null) {
  const url = new URL(request.url);
  const method = request.method;

  try {
    // 首次请求时初始化表（Worker 冷启动后仅一次）
    if (!initPromise) initPromise = initDb(env.DB);
    await initPromise;

    /* ════════════════════════════════════════════
     * GET /api/comment/list?path=xxx&sort=oldest|newest
     * ════════════════════════════════════════════ */


    /* ════════════════════════════════════════════
     * GET /api/comment/stats — 评论总数统计
     * ════════════════════════════════════════════ */

    if (method === "GET" && url.pathname === "/api/comment/stats") {
      console.log("查询评论统计", { module: "comment", action: "stats" });
      const token = await getInstallationToken(env);
      const data = await gql<StatsResult>(token, STATS_QUERY, {
        owner: env.GITHUB_REPO_OWNER,
        name: env.GITHUB_REPO_NAME,
        categoryId: env.GITHUB_DISCUSSION_CATEGORY_ID,
      });
      const discussions = data.repository.discussions;
      const totalComments = discussions.nodes.reduce((s, n) => s + n.comments.nodes.reduce((s2, c) => s2 + 1 + (c.replies?.nodes?.length || 0), 0), 0);
      return respond({ totalDiscussions: discussions.totalCount, totalComments }, "ok", 1, origin);
    }

    
    /* ════════════════════════════════════════════
     * GET /api/comment/counts?prefix=/article
     * ════════════════════════════════════════════ */

    
    /* ════════════════════════════════════════════
     * GET /api/comment/count?path=xxx
     * ════════════════════════════════════════════ */

    if (method === "GET" && url.pathname === "/api/comment/count") {
      const path = url.searchParams.get("path");
      if (!path) return respond(null, "缺少 path 参数", 0, origin);
      console.log("查询评论数", { module: "comment", action: "count", path });

      const token = await getInstallationToken(env);
      // 同时搜有无斜杠结尾
      const variants = path.endsWith("/") ? [path, path.slice(0, -1)] : [path, path + "/"];
      for (const p of variants) {
        const q = REPO_SEARCH(env.GITHUB_REPO_OWNER, env.GITHUB_REPO_NAME) + ' "' + p + '" in:title';
        const data = await gql<SearchResult>(token, SEARCH_DISCUSSION, { query: q });
        if (data.search.nodes[0]) {
          return respond({ count: data.search.nodes[0].comments.nodes.reduce((s, c) => s + 1 + (c.replies?.nodes?.length || 0), 0) }, "ok", 1, origin);
        }
      }
      return respond({ count: 0 }, "ok", 1, origin);
    }

    if (method === "GET" && url.pathname === "/api/comment/counts") {
      const prefix = url.searchParams.get("prefix");
      if (!prefix) return respond(null, "缺少 prefix 参数", 0, origin);
      console.log("批量查询评论数", { module: "comment", action: "counts", prefix });

      const token = await getInstallationToken(env);
      const searchQuery = REPO_SEARCH(env.GITHUB_REPO_OWNER, env.GITHUB_REPO_NAME) + ' "' + prefix + '" in:title';
      const data = await gql<CountsResult>(token, COUNTS_QUERY, { query: searchQuery });

      const counts = data.search.nodes.map((n) => ({
        path: n.title,
        count: n.comments.nodes.reduce((s, c) => s + 1 + (c.replies?.nodes?.length || 0), 0),
      }));

      return respond(counts, "ok", 1, origin);
    }

if (method === "GET" && url.pathname === "/api/comment/list") {
      const path = url.searchParams.get("path");
      if (!path) return respond(null, "缺少 path 参数", 0, origin);
      console.log("查询评论列表", { module: "comment", action: "list", path });

      const sort = url.searchParams.get("sort") || "oldest";

      // 获取当前登录用户 ID（可选）
      let viewerId: number | undefined;
      const auth = request.headers.get("Authorization");
      if (auth?.startsWith("Bearer ")) {
        const payload = await verifyJwt(auth.slice(7), env.JWT_SECRET);
        if (payload) viewerId = Number(payload.sub);
      }

      const token = await getInstallationToken(env);
      const searchQuery = `${REPO_SEARCH(env.GITHUB_REPO_OWNER, env.GITHUB_REPO_NAME)} "${path}" in:title`;
      const data = await gql<SearchResult>(token, SEARCH_DISCUSSION, { query: searchQuery });

      const discussion = data.search.nodes[0] ?? null;

      if (!discussion) {
        return respond(
          { discussionId: null, locked: false, comments: [], discussionReactions: [] },
          "ok", 1, origin,
        );
      }

      // 取所有 subject ID（discussion + 所有评论 + 所有回复）
      const allNodes = discussion.comments.nodes.flatMap((c) => [
        c,
        ...(c.replies?.nodes || []),
      ]);
      allNodes.push({ id: discussion.id } as GqlComment); // discussion 本身也可有 reaction

      const subjectIds = allNodes.map((n) => n.id);
      const reactionMap = await getReactions(env.DB, subjectIds, viewerId);
      const upvoteMap = await getUpvotes(env.DB, subjectIds, viewerId);

      const { topLevel, discussionReactions } = buildCommentTree(
        discussion.comments.nodes,
        reactionMap,
        upvoteMap,
        reactionMap.get(discussion.id),
      );

      // 排序
      if (sort === "newest") {
        topLevel.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        topLevel.forEach((c) => {
          c.replies.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        });
      } else {
        topLevel.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        topLevel.forEach((c) => {
          c.replies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        });
      }

      return respond(
        {
          discussionId: discussion.id,
          locked: discussion.locked,
          comments: topLevel,
          discussionReactions,
        },
        "ok", 1, origin,
      );
    }

    /* ════════════════════════════════════════════
     * POST /api/comment/reaction — 切换反应
     * ════════════════════════════════════════════ */

    if (method === "POST" && url.pathname === "/api/comment/reaction") {
      const auth = request.headers.get("Authorization");
      if (!auth?.startsWith("Bearer ")) return respond(null, "未登录", 0, origin);
      console.log("评论反应操作", { module: "comment", action: "reaction" });
      const payload = await verifyJwt(auth.slice(7), env.JWT_SECRET);
      if (!payload) return respond(null, "登录已过期", 0, origin);

      const userId = Number(payload.sub);
      const { subjectId, reaction } = (await request.json()) as {
        subjectId: string;
        reaction: string;
      };

      if (!subjectId || !reaction) return respond(null, "缺少 subjectId 或 reaction", 0, origin);
      if (!REACTIONS.includes(reaction as Reaction)) {
        return respond(null, `不支持的反应类型: ${reaction}`, 0, origin);
      }

      // 检查是否已点过这个 reaction
      const existing = await env.DB
        .prepare("SELECT id FROM comment_reaction WHERE subject_id = ? AND user_id = ? AND reaction = ?")
        .bind(subjectId, userId, reaction)
        .first<{ id: number }>();

      if (existing) {
        // 已点过 → 取消
        await env.DB
          .prepare("DELETE FROM comment_reaction WHERE subject_id = ? AND user_id = ? AND reaction = ?")
          .bind(subjectId, userId, reaction)
          .run();
        return respond({ active: false, reaction }, "取消反应", 1, origin);
      }

      // 没点过 → 添加
      await env.DB
        .prepare("INSERT OR IGNORE INTO comment_reaction (subject_id, user_id, reaction) VALUES (?, ?, ?)")
        .bind(subjectId, userId, reaction)
        .run();
      return respond({ active: true, reaction }, "反应成功", 1, origin);
    }

    /* ════════════════════════════════════════════
     * POST /api/comment/upvote — 切换点赞
     * ════════════════════════════════════════════ */

    if (method === "POST" && url.pathname === "/api/comment/upvote") {
      const auth = request.headers.get("Authorization");
      if (!auth?.startsWith("Bearer ")) return respond(null, "未登录", 0, origin);
      const payload = await verifyJwt(auth.slice(7), env.JWT_SECRET);
      if (!payload) return respond(null, "登录已过期", 0, origin);

      const userId = Number(payload.sub);
      const { subjectId } = (await request.json()) as { subjectId: string };
      if (!subjectId) return respond(null, "缺少 subjectId", 0, origin);

      // 是否已点过
      const existing = await env.DB
        .prepare("SELECT id FROM comment_upvote WHERE subject_id = ? AND user_id = ?")
        .bind(subjectId, userId)
        .first<{ id: number }>();

      if (existing) {
        await env.DB
          .prepare("DELETE FROM comment_upvote WHERE subject_id = ? AND user_id = ?")
          .bind(subjectId, userId)
          .run();
        return respond({ active: false }, "取消点赞", 1, origin);
      }

      await env.DB
        .prepare("INSERT OR IGNORE INTO comment_upvote (subject_id, user_id) VALUES (?, ?)")
        .bind(subjectId, userId)
        .run();
      return respond({ active: true }, "点赞成功", 1, origin);
    }

    /* ════════════════════════════════════════════
     * POST /api/comment — 创建评论 / 回复
     * ════════════════════════════════════════════ */

    if (method === "POST" && url.pathname === "/api/comment") {
      const auth = request.headers.get("Authorization");
      const guestSession = request.headers.get("X-Guest-Session");
      console.log("创建评论", { module: "comment", action: "create" });

      let userId: number | null = null;
      let nickname = "";
      let avatar = "";

      if (auth?.startsWith("Bearer ")) {
        const payload = await verifyJwt(auth.slice(7), env.JWT_SECRET);
        if (!payload) return respond(null, "登录已过期", 0, origin);
        userId = Number(payload.sub);
        const user = await env.DB
          .prepare("SELECT id, nickname, avatar FROM user WHERE id = ? AND deleted = 0")
          .bind(userId)
          .first<{ id: number; nickname: string; avatar?: string }>();
        if (!user) return respond(null, "用户不存在", 0, origin);
        nickname = user.nickname;
        avatar = user.avatar || "";
      } else if (!guestSession) {
        return respond(null, "未登录", 0, origin);
      }

      const body = (await request.json()) as { path: string; content: string; replyToId?: string; nickname?: string };
      if (!body.path || !body.content?.trim()) {
        return respond(null, "缺少 path 或 content", 0, origin);
      }

      if (!userId) {
        if (!body.nickname?.trim()) return respond(null, "请提供昵称", 0, origin);
        nickname = body.nickname.trim().slice(0, 20);
      }

      const token = await getInstallationToken(env);
      const searchQuery = `${REPO_SEARCH(env.GITHUB_REPO_OWNER, env.GITHUB_REPO_NAME)} "${body.path}" in:title`;
      const searchData = await gql<SearchResult>(token, SEARCH_DISCUSSION, { query: searchQuery });
      let discussionId = searchData.search.nodes[0]?.id;

      if (!discussionId) {
        const repoQuery = `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { id } }`;
        const repoData = await gql<{ repository: { id: string } }>(token, repoQuery, {
          owner: env.GITHUB_REPO_OWNER,
          name: env.GITHUB_REPO_NAME,
        });
        const created = await gql<CreateResult>(token, CREATE_DISCUSSION, {
          repoId: repoData.repository.id,
          categoryId: env.GITHUB_DISCUSSION_CATEGORY_ID,
          title: body.path,
          body: `<!--path:${body.path}-->`,
        });
        discussionId = created.createDiscussion.discussion.id;
      }

      let writeToken: string;
      let finalBody: string;
      let author: { id: number; nickname: string; avatar: string };

      if (userId) {
        const ghToken = await getUserToken(env, userId);
        writeToken = ghToken || token;
        finalBody = embedUser(body.content.trim(), userId, nickname, avatar);
        author = { id: userId, nickname, avatar };
      } else {
        writeToken = token;
        finalBody = `<!--guest:${guestSession}|${nickname}-->\n${body.content.trim()}`;
        author = { id: 0, nickname, avatar: "" };
      }

      const variables: Record<string, unknown> = { discussionId, body: finalBody };
      if (body.replyToId) variables.replyToId = body.replyToId;

      const result = await gql<AddCommentResult>(writeToken, ADD_COMMENT, variables);
      const c = result.addDiscussionComment.comment;

      return respond(
        {
          nodeId: c.id,
          content: body.content.trim(),
          author,
          createdAt: c.createdAt,
          lastEditedAt: c.lastEditedAt || null,
          replyToId: c.replyTo?.id || null,
          reactions: [],
          upvoteCount: 0,
          viewerHasUpvoted: false,
          replies: [],
        },
        "评论成功", 1, origin,
      );
    }

    /* ════════════════════════════════════════════
     * PATCH /api/comment/:nodeId — 编辑
     * ════════════════════════════════════════════ */

    if (method === "PATCH" && url.pathname.startsWith("/api/comment/")) {
      const auth = request.headers.get("Authorization");
      const guestSession = request.headers.get("X-Guest-Session");
      if (!auth?.startsWith("Bearer ") && !guestSession) return respond(null, "未登录", 0, origin);

      const nodeId = url.pathname.replace("/api/comment/", "");
      const editBody = (await request.json()) as { content: string; nickname?: string };
      if (!editBody.content?.trim()) return respond(null, "内容不能为空", 0, origin);

      const token = await getInstallationToken(env);

      if (auth?.startsWith("Bearer ")) {
        const payload = await verifyJwt(auth.slice(7), env.JWT_SECRET);
        if (!payload) return respond(null, "登录已过期", 0, origin);
        const user = await env.DB
          .prepare("SELECT id, nickname, avatar FROM user WHERE id = ? AND deleted = 0")
          .bind(Number(payload.sub))
          .first<{ id: number; nickname: string; avatar?: string }>();
        if (!user) return respond(null, "用户不存在", 0, origin);
        if (!(await checkOwnership(token, nodeId, user.id, user.nickname))) {
          return respond(null, "无权编辑此评论", 0, origin);
        }
        const commentBody = embedUser(editBody.content.trim(), user.id, user.nickname, user.avatar);
        await gql(token, UPDATE_COMMENT, { commentId: nodeId, body: commentBody });
      } else {
        if (!(await checkGuestOwnership(token, nodeId, guestSession!))) {
          return respond(null, "无权编辑此评论", 0, origin);
        }
        const guestNickname = editBody.nickname?.trim().slice(0, 20) || "";
        const commentBody = `<!--guest:${guestSession}|${guestNickname}-->\n${editBody.content.trim()}`;
        await gql(token, UPDATE_COMMENT, { commentId: nodeId, body: commentBody });
      }
      return respond(null, "编辑成功", 1, origin);
    }

    /* ════════════════════════════════════════════
     * DELETE /api/comment/:nodeId — 删除
     * ════════════════════════════════════════════ */

    if (method === "DELETE" && url.pathname.startsWith("/api/comment/")) {
      const auth = request.headers.get("Authorization");
      const guestSession = request.headers.get("X-Guest-Session");
      if (!auth?.startsWith("Bearer ") && !guestSession) return respond(null, "未登录", 0, origin);

      const nodeId = url.pathname.replace("/api/comment/", "");
      const token = await getInstallationToken(env);

      if (auth?.startsWith("Bearer ")) {
        const payload = await verifyJwt(auth.slice(7), env.JWT_SECRET);
        if (!payload) return respond(null, "登录已过期", 0, origin);
        const userDel = await env.DB
          .prepare("SELECT nickname FROM user WHERE id = ? AND deleted = 0")
          .bind(Number(payload.sub))
          .first<{ nickname: string }>();
        if (!userDel) return respond(null, "用户不存在", 0, origin);
        if (!(await checkOwnership(token, nodeId, Number(payload.sub), userDel.nickname))) {
          return respond(null, "无权删除此评论", 0, origin);
        }
      } else {
        if (!(await checkGuestOwnership(token, nodeId, guestSession!))) {
          return respond(null, "无权删除此评论", 0, origin);
        }
      }

      const replyIds = await getReplyIds(token, nodeId);
      for (const rid of replyIds) {
        await gql(token, DELETE_COMMENT, { commentId: rid }).catch(() => {});
      }
      await gql(token, DELETE_COMMENT, { commentId: nodeId });
      return respond(null, "删除成功", 1, origin);
    }

    return respond(null, "Not Found", 0, origin);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "未知错误";
    console.error("评论接口异常", { module: "comment", action: "handler_error", method, path: url.pathname, error: msg });
    return respond({ error: msg }, "评论服务错误", 0, origin);
  }
}





