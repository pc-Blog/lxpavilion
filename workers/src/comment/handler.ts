/**
 * 评论系统 — 基于 D1
 *
 * 评论正文、层级、作者归属全部存 D1 的 comment 表；
 * 作者信息（昵称、头像）统一通过 user_id 关联 user 表获取。
 *
 * 身份：
 *   - 登录用户：JWT（Authorization: Bearer），编辑/删除要求 comment.user_id === jwt.sub
 *   - 游客：没有身份。昵称仅用于显示，按昵称查/建 user 占位行；
 *           编辑/删除仅校验 1 小时窗口，归属由前端依据 localStorage 里的评论 id 自行判断
 *
 * 编辑/删除窗口：1 小时（前后端一致，后端按 create_time 校验）
 *
 * Emoji 反应、点赞存 D1，subject_id 指向 comment.id
 */

import { respond } from "../utils/response";
import { verifyJwt } from "../utils/jwt";
import type { Env } from "../types";

/* ── 模块级初始化（Worker 冷启动时执行一次） ── */

let initPromise: Promise<void> | null = null;

async function initDb(db: D1Database) {
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS comment (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL, parent_id INTEGER, user_id INTEGER NOT NULL, content TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, create_time TEXT NOT NULL DEFAULT (datetime('now')), update_time TEXT NOT NULL DEFAULT (datetime('now')))",
  ).run();
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS comment_reaction (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER NOT NULL, user_id INTEGER NOT NULL, reaction TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), UNIQUE(subject_id, user_id, reaction))",
  ).run();
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS comment_upvote (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_id INTEGER NOT NULL, user_id INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now')), UNIQUE(subject_id, user_id))",
  ).run();
  initPromise = null;
}

/* ── 常量 ── */

/** 8 种反应（沿用原有集合，保持前端兼容） */
const REACTIONS = [
  "THUMBS_UP", "THUMBS_DOWN", "LAUGH", "HOORAY",
  "CONFUSED", "HEART", "ROCKET", "EYES",
] as const;
type Reaction = (typeof REACTIONS)[number];

/** 编辑/删除窗口：1 小时（毫秒） */
const EDIT_WINDOW_MS = 60 * 60 * 1000;

/* ── 通用工具 ── */

/** 生成游客占位用户名（随机码，保证唯一） */
function genGuestUsername(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return "g_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * D1 的 datetime('now') 返回 "YYYY-MM-DD HH:MM:SS"（UTC 无时区标记），
 * 直接交给前端 new Date() 会被当本地时间解析，需补成 ISO。
 * 迁移导入的数据本身是 ISO，原样返回。
 */
function normalizeTime(s: string | null): string {
  if (!s) return "";
  if (s.includes("T")) return s;
  return s.replace(" ", "T") + "Z";
}

/** 登录用户 id（校验 JWT）；未登录或 token 无效返回 null */
async function resolveUserId(request: Request, env: Env): Promise<number | null> {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const payload = await verifyJwt(auth.slice(7), env.JWT_SECRET);
  return payload ? Number(payload.sub) : null;
}

/**
 * 判断能否编辑/删除一条评论。
 *
 * 登录用户：必须是自己发的（user_id 匹配），且在 1 小时窗口内。
 * 游客：无从校验归属（游客没有身份），只校验 1 小时窗口。
 *       客户端把评论 id 存在 localStorage，仅用于决定是否显示按钮。
 */
function canManage(userId: number | null, commentUserId: number, createTime: string): boolean {
  const t = new Date(normalizeTime(createTime)).getTime();
  if (Number.isNaN(t)) return false;
  if (Date.now() - t >= EDIT_WINDOW_MS) return false;
  // 未登录（游客）→ 窗口内即放行；已登录 → 还必须是本人
  return userId === null || userId === commentUserId;
}

/* ── 反应 / 点赞查询 ── */

interface ReactionGroup {
  reaction: string;
  count: number;
  viewerHasReacted: boolean;
}

interface UpvoteData {
  upvoteCount: number;
  viewerHasUpvoted: boolean;
}

async function getReactions(
  db: D1Database,
  subjectIds: number[],
  userId: number | null,
): Promise<Map<number, ReactionGroup[]>> {
  const result = new Map<number, ReactionGroup[]>();
  if (subjectIds.length === 0) return result;

  const placeholders = subjectIds.map(() => "?").join(",");
  const counts = await db
    .prepare(
      `SELECT subject_id, reaction, COUNT(*) AS count FROM comment_reaction
       WHERE subject_id IN (${placeholders}) GROUP BY subject_id, reaction`,
    )
    .bind(...subjectIds)
    .all<{ subject_id: number; reaction: string; count: number }>();

  let reactedSet = new Set<string>();
  if (userId !== null) {
    const userRows = await db
      .prepare(
        `SELECT subject_id, reaction FROM comment_reaction
         WHERE subject_id IN (${placeholders}) AND user_id = ?`,
      )
      .bind(...subjectIds, userId)
      .all<{ subject_id: number; reaction: string }>();
    reactedSet = new Set(userRows.results.map((r) => `${r.subject_id}:${r.reaction}`));
  }

  const grouped = new Map<number, Map<string, number>>();
  for (const r of counts.results) {
    if (!grouped.has(r.subject_id)) grouped.set(r.subject_id, new Map());
    grouped.get(r.subject_id)!.set(r.reaction, r.count);
  }

  for (const id of subjectIds) {
    const c = grouped.get(id) || new Map<string, number>();
    result.set(
      id,
      REACTIONS.map((r) => ({
        reaction: r,
        count: c.get(r) || 0,
        viewerHasReacted: reactedSet.has(`${id}:${r}`),
      })),
    );
  }
  return result;
}

async function getUpvotes(
  db: D1Database,
  subjectIds: number[],
  userId: number | null,
): Promise<Map<number, UpvoteData>> {
  const result = new Map<number, UpvoteData>();
  if (subjectIds.length === 0) return result;

  const placeholders = subjectIds.map(() => "?").join(",");
  const counts = await db
    .prepare(
      `SELECT subject_id, COUNT(*) AS count FROM comment_upvote
       WHERE subject_id IN (${placeholders}) GROUP BY subject_id`,
    )
    .bind(...subjectIds)
    .all<{ subject_id: number; count: number }>();

  let votedSet = new Set<number>();
  if (userId !== null) {
    const userRows = await db
      .prepare(
        `SELECT subject_id FROM comment_upvote
         WHERE subject_id IN (${placeholders}) AND user_id = ?`,
      )
      .bind(...subjectIds, userId)
      .all<{ subject_id: number }>();
    votedSet = new Set(userRows.results.map((r) => r.subject_id));
  }

  const countMap = new Map(counts.results.map((r) => [r.subject_id, r.count]));
  for (const id of subjectIds) {
    result.set(id, {
      upvoteCount: countMap.get(id) || 0,
      viewerHasUpvoted: votedSet.has(id),
    });
  }
  return result;
}

/* ── 行 → VO ── */

interface CommentRow {
  id: number;
  path: string;
  parent_id: number | null;
  user_id: number;
  content: string;
  deleted: number;
  create_time: string;
  update_time: string;
  author_nickname: string | null;
  author_avatar: string | null;
  author_username: string | null;
}

interface AuthorVO {
  id: number;
  nickname: string;
  avatar: string;
}

interface CommentVO {
  /** 评论 id（字段名沿用 nodeId，保持前端契约不变） */
  nodeId: number;
  content: string;
  author: AuthorVO;
  createdAt: string;
  lastEditedAt: string | null;
  deletedAt: string | null;
  replyToId: number | null;
  reactions: ReactionGroup[];
  upvoteCount: number;
  viewerHasUpvoted: boolean;
  replies: CommentVO[];
}

function toVo(
  row: CommentRow,
  reactions: Map<number, ReactionGroup[]>,
  upvotes: Map<number, UpvoteData>,
): CommentVO {
  const uv = upvotes.get(row.id) || { upvoteCount: 0, viewerHasUpvoted: false };
  const isDeleted = row.deleted === 1;
  const createdAt = normalizeTime(row.create_time);
  const updateTime = normalizeTime(row.update_time);

  // 昵称为空时回退到 username，避免前端显示空白
  const nickname = row.author_nickname || row.author_username || "Anonymous";

  return {
    nodeId: row.id,
    content: isDeleted ? "" : row.content,
    author: {
      id: row.user_id,
      nickname,
      avatar: row.author_avatar || "",
    },
    createdAt,
    // 编辑过才有 lastEditedAt；未编辑时 update_time === create_time
    lastEditedAt: updateTime && updateTime !== createdAt ? updateTime : null,
    // 已删除才有 deletedAt（前端靠它渲染「该评论已被删除」）
    deletedAt: isDeleted ? updateTime : null,
    replyToId: row.parent_id,
    reactions: reactions.get(row.id) || [],
    upvoteCount: uv.upvoteCount,
    viewerHasUpvoted: uv.viewerHasUpvoted,
    replies: [],
  };
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
     * GET /api/comment/stats — 评论总数统计
     * ════════════════════════════════════════════ */

    if (method === "GET" && url.pathname === "/api/comment/stats") {
      console.log("查询评论统计", { module: "comment", action: "stats" });
      const row = await env.DB.prepare(
        "SELECT COUNT(*) AS totalComments, COUNT(DISTINCT path) AS totalDiscussions FROM comment WHERE deleted = 0",
      ).first<{ totalComments: number; totalDiscussions: number }>();
      return respond(
        {
          totalDiscussions: row?.totalDiscussions ?? 0,
          totalComments: row?.totalComments ?? 0,
        },
        "ok", 1, origin,
      );
    }

    /* ════════════════════════════════════════════
     * GET /api/comment/count?path=xxx — 单页评论数
     * ════════════════════════════════════════════ */

    if (method === "GET" && url.pathname === "/api/comment/count") {
      const path = url.searchParams.get("path");
      if (!path) return respond(null, "缺少 path 参数", 0, origin);
      console.log("查询评论数", { module: "comment", action: "count", path });

      const row = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM comment WHERE path = ? AND deleted = 0",
      ).bind(path).first<{ count: number }>();
      return respond({ count: row?.count ?? 0 }, "ok", 1, origin);
    }

    /* ════════════════════════════════════════════
     * GET /api/comment/counts?prefix=/article — 批量评论数
     * ════════════════════════════════════════════ */

    if (method === "GET" && url.pathname === "/api/comment/counts") {
      const prefix = url.searchParams.get("prefix");
      if (!prefix) return respond(null, "缺少 prefix 参数", 0, origin);
      console.log("批量查询评论数", { module: "comment", action: "counts", prefix });

      const rows = await env.DB.prepare(
        "SELECT path, COUNT(*) AS count FROM comment WHERE path LIKE ? AND deleted = 0 GROUP BY path",
      ).bind(`${prefix}%`).all<{ path: string; count: number }>();

      return respond(rows.results.map((r) => ({ path: r.path, count: r.count })), "ok", 1, origin);
    }

    /* ════════════════════════════════════════════
     * GET /api/comment/list?path=xxx — 评论列表（两层树）
     * ════════════════════════════════════════════ */

    if (method === "GET" && url.pathname === "/api/comment/list") {
      const path = url.searchParams.get("path");
      if (!path) return respond(null, "缺少 path 参数", 0, origin);
      console.log("查询评论列表", { module: "comment", action: "list", path });

      const userId = await resolveUserId(request, env);

      const rows = await env.DB.prepare(
        `SELECT c.id, c.path, c.parent_id, c.user_id, c.content, c.deleted, c.create_time, c.update_time,
                u.nickname AS author_nickname, u.avatar AS author_avatar, u.username AS author_username
         FROM comment c LEFT JOIN user u ON u.id = c.user_id
         WHERE c.path = ? ORDER BY c.create_time ASC`,
      ).bind(path).all<CommentRow>();

      const all = rows.results;
      const ids = all.map((r) => r.id);
      const reactionMap = await getReactions(env.DB, ids, userId);
      const upvoteMap = await getUpvotes(env.DB, ids, userId);

      // 组装两层树：顶层评论 + 挂到父节点下的回复
      const tops: CommentVO[] = [];
      const byId = new Map<number, CommentVO>();
      for (const r of all) {
        if (r.parent_id === null) {
          const vo = toVo(r, reactionMap, upvoteMap);
          byId.set(r.id, vo);
          tops.push(vo);
        }
      }
      for (const r of all) {
        if (r.parent_id !== null) {
          const parent = byId.get(r.parent_id);
          // 父评论不在本列表（已删或数据异常）→ 跳过，避免产生看不见的孤儿
          if (!parent) continue;
          parent.replies.push(toVo(r, reactionMap, upvoteMap));
        }
      }

      return respond(
        {
          discussionId: path,
          locked: false,
          comments: tops,
          discussionReactions: [],
        },
        "ok", 1, origin,
      );
    }

    /* ════════════════════════════════════════════
     * POST /api/comment/reaction — 切换反应
     * ════════════════════════════════════════════ */

    if (method === "POST" && url.pathname === "/api/comment/reaction") {
      const userId = await resolveUserId(request, env);
      if (userId === null) return respond(null, "未登录", 0, origin);
      console.log("评论反应操作", { module: "comment", action: "reaction" });

      const { subjectId, reaction } = (await request.json()) as {
        subjectId: number;
        reaction: string;
      };

      if (!subjectId || !reaction) return respond(null, "缺少 subjectId 或 reaction", 0, origin);
      if (!REACTIONS.includes(reaction as Reaction)) {
        return respond(null, `不支持的反应类型: ${reaction}`, 0, origin);
      }

      const existing = await env.DB
        .prepare("SELECT id FROM comment_reaction WHERE subject_id = ? AND user_id = ? AND reaction = ?")
        .bind(subjectId, userId, reaction)
        .first<{ id: number }>();

      if (existing) {
        await env.DB
          .prepare("DELETE FROM comment_reaction WHERE subject_id = ? AND user_id = ? AND reaction = ?")
          .bind(subjectId, userId, reaction)
          .run();
        return respond({ active: false, reaction }, "取消反应", 1, origin);
      }

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
      const userId = await resolveUserId(request, env);
      if (userId === null) return respond(null, "未登录", 0, origin);

      const { subjectId } = (await request.json()) as { subjectId: number };
      if (!subjectId) return respond(null, "缺少 subjectId", 0, origin);

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
      console.log("创建评论", { module: "comment", action: "create" });
      const body = (await request.json()) as {
        path: string;
        content: string;
        replyToId?: number;
        nickname?: string;
      };
      if (!body.path || !body.content?.trim()) {
        return respond(null, "缺少 path 或 content", 0, origin);
      }

      const userId = await resolveUserId(request, env);
      let authorId: number | null = null;

      if (userId !== null) {
        // 登录用户：确认存在
        const user = await env.DB
          .prepare("SELECT id FROM user WHERE id = ? AND deleted = 0")
          .bind(userId)
          .first<{ id: number }>();
        if (!user) return respond(null, "用户不存在", 0, origin);
        authorId = userId;
      } else {
        // 游客：昵称必填，按昵称查/建占位行（同名即复用同一行）
        const nickname = body.nickname?.trim().slice(0, 20);
        if (!nickname) return respond(null, "请提供昵称", 0, origin);

        const exist = await env.DB
          .prepare("SELECT id FROM user WHERE nickname = ? AND deleted = 0")
          .bind(nickname)
          .first<{ id: number }>();
        if (exist) {
          authorId = exist.id;
        } else {
          // username 唯一，用随机码占位；撞上则重试
          for (let attempt = 0; attempt < 3 && authorId === null; attempt++) {
            const ins = await env.DB
              .prepare("INSERT OR IGNORE INTO user (username, password, nickname, deleted) VALUES (?, '', ?, 0) RETURNING id")
              .bind(genGuestUsername(), nickname)
              .first<{ id: number }>();
            if (ins) authorId = ins.id;
          }
        }
        if (authorId === null) return respond(null, "创建游客记录失败", 0, origin);
      }

      // 回复：校验父评论存在且同属该 path
      let parentId: number | null = null;
      if (body.replyToId) {
        const parent = await env.DB
          .prepare("SELECT id FROM comment WHERE id = ? AND path = ? AND deleted = 0")
          .bind(body.replyToId, body.path)
          .first<{ id: number }>();
        if (!parent) return respond(null, "父评论不存在", 0, origin);
        parentId = parent.id;
      }

      const content = body.content.trim();
      const inserted = await env.DB
        .prepare(
          "INSERT INTO comment (path, parent_id, user_id, content) VALUES (?, ?, ?, ?) RETURNING id, create_time, update_time",
        )
        .bind(body.path, parentId, authorId, content)
        .first<{ id: number; create_time: string; update_time: string }>();
      if (!inserted) return respond(null, "评论写入失败", 0, origin);

      // 回读作者信息，保证与列表接口口径一致
      const author = await env.DB
        .prepare("SELECT id, nickname, avatar, username FROM user WHERE id = ?")
        .bind(authorId)
        .first<{ id: number; nickname: string | null; avatar: string | null; username: string }>();

      const vo: CommentVO = {
        nodeId: inserted.id,
        content,
        author: {
          id: authorId,
          nickname: author?.nickname || author?.username || "Anonymous",
          avatar: author?.avatar || "",
        },
        createdAt: normalizeTime(inserted.create_time),
        lastEditedAt: null,
        deletedAt: null,
        replyToId: parentId,
        reactions: REACTIONS.map((r) => ({ reaction: r, count: 0, viewerHasReacted: false })),
        upvoteCount: 0,
        viewerHasUpvoted: false,
        replies: [],
      };
      return respond(vo, "评论成功", 1, origin);
    }

    /* ════════════════════════════════════════════
     * PATCH /api/comment/:id — 编辑（1 小时内）
     * ════════════════════════════════════════════ */

    if (method === "PATCH" && url.pathname.startsWith("/api/comment/")) {
      const id = Number(url.pathname.replace("/api/comment/", ""));
      if (!Number.isInteger(id) || id <= 0) return respond(null, "无效的评论 id", 0, origin);

      const editBody = (await request.json()) as { content: string };
      if (!editBody.content?.trim()) return respond(null, "内容不能为空", 0, origin);

      const ownerId = await resolveUserId(request, env);
      const row = await env.DB
        .prepare("SELECT id, user_id, deleted, create_time FROM comment WHERE id = ?")
        .bind(id)
        .first<{ id: number; user_id: number; deleted: number; create_time: string }>();
      if (!row || row.deleted === 1) return respond(null, "评论不存在", 0, origin);

      if (!canManage(ownerId, row.user_id, row.create_time)) {
        return respond(null, "无权编辑此评论或已超过编辑时限", 0, origin);
      }

      await env.DB
        .prepare("UPDATE comment SET content = ?, update_time = datetime('now') WHERE id = ?")
        .bind(editBody.content.trim(), id)
        .run();
      return respond(null, "编辑成功", 1, origin);
    }

    /* ════════════════════════════════════════════
     * DELETE /api/comment/:id — 删除（连同回复）
     * ════════════════════════════════════════════ */

    if (method === "DELETE" && url.pathname.startsWith("/api/comment/")) {
      const id = Number(url.pathname.replace("/api/comment/", ""));
      if (!Number.isInteger(id) || id <= 0) return respond(null, "无效的评论 id", 0, origin);

      const ownerId = await resolveUserId(request, env);
      const row = await env.DB
        .prepare("SELECT id, user_id, deleted, create_time FROM comment WHERE id = ?")
        .bind(id)
        .first<{ id: number; user_id: number; deleted: number; create_time: string }>();
      if (!row || row.deleted === 1) return respond(null, "评论不存在", 0, origin);

      if (!canManage(ownerId, row.user_id, row.create_time)) {
        return respond(null, "无权删除此评论或已超过编辑时限", 0, origin);
      }

      // 删除父评论时连同其回复一并标记删除（沿用原有语义）
      await env.DB
        .prepare("UPDATE comment SET deleted = 1, update_time = datetime('now') WHERE id = ? OR parent_id = ?")
        .bind(id, id)
        .run();
      return respond(null, "删除成功", 1, origin);
    }

    return respond(null, "Not Found", 0, origin);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "未知错误";
    console.error("评论接口异常", {
      module: "comment",
      action: "handler_error",
      method,
      path: url.pathname,
      error: msg,
    });
    return respond({ error: msg }, "评论服务错误", 0, origin);
  }
}
