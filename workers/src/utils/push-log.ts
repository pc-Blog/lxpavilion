/**
 * 推送日志写入与去重状态
 *
 * 去重状态只保存在该分组最新一行，两个分组的形态不同：
 *   - article     只存本次推送的文章 id，读取时取其中最大的 id 作为下次推送的起点
 *   - hot-topics  累积保存 "URL 哈希:推送时间"，读取时丢弃超过 RETAIN_DAYS 天的条目，
 *                 并按哈希去重（热点要判断某条 URL 推过没有，需要全量历史）
 *
 * 成功行把本次结果并入状态；跳过 / 失败行直接继承上一行。
 * hot-topics 写入新行时清空上一行，避免同一批数据在多行里重复。
 * 两个分组各保留最近 KEEP_PER_GROUP 条日志。
 */

/** 每个分组保留的最大日志条数 */
const KEEP_PER_GROUP = 10;

/** 热点去重条目的保留天数 */
const RETAIN_DAYS = 30;

/** 需要累积全量历史的去重分组 */
const CUMULATIVE_GROUPS = new Set(["hot-topics"]);

/** 单次推送结果 */
export type PushLogStatus = "success" | "skipped" | "failed";

/** 一条推送日志 */
export interface PushLogEntry {
  /** 分组名，如 article、hot-topics */
  group: string;
  /** 本次运行结果 */
  status: PushLogStatus;
  /** 本次涉及的文章/条目数 */
  articleCount: number;
  /** 订阅者数 */
  subscriberCount: number;
  /** 成功时传本次推送的 id：article 为文章 id，hot-topics 为 URL 哈希 */
  articleIds?: (string | number)[];
  /** 失败原因，仅 status 为 failed 时有值 */
  errorMsg?: string;
}

/** 当前时间戳（秒） */
function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/** 读取该分组最新一行的状态原文 */
async function readRawLast(db: D1Database, group: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT article_ids FROM push_logs WHERE group_name = ? ORDER BY id DESC LIMIT 1")
    .bind(group)
    .first<{ article_ids: string | null }>();
  return row?.article_ids ?? null;
}

/** 把状态原文解析成条目数组（保留原始类型） */
function parseEntries(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * 读取 article 分组的推送起点：最后推送的文章 id。
 *
 * @param db    D1 连接
 * @param group 分组名
 * @returns 已推送的最大文章 id；无记录时为 0
 */
export async function readArticleStartId(db: D1Database, group: string): Promise<number> {
  const ids = parseEntries(await readRawLast(db, group))
    .map(Number)
    .filter((n) => Number.isFinite(n));
  return ids.length > 0 ? Math.max(...ids) : 0;
}

/**
 * 读取 hot-topics 分组的已推送 URL 哈希，顺带丢弃过期条目。
 *
 * @param db    D1 连接
 * @param group 分组名
 * @returns 仍在保留期内的已推送哈希集合
 */
export async function readPushedHashes(db: D1Database, group: string): Promise<Set<string>> {
  const cutoff = nowSec() - RETAIN_DAYS * 86_400;
  const hashes = new Set<string>();

  for (const entry of parseEntries(await readRawLast(db, group))) {
    const [hash, ts] = String(entry).split(":");
    if (!hash) continue;
    if (ts !== undefined && Number(ts) < cutoff) continue;
    hashes.add(hash);
  }
  return hashes;
}

/**
 * 写入一条推送日志，并把该分组的日志裁剪到最近 KEEP_PER_GROUP 条。
 *
 * @param db    D1 连接
 * @param entry 日志内容
 * @returns 新插入行的 id
 */
export async function insertPushLog(db: D1Database, entry: PushLogEntry): Promise<number> {
  const { group } = entry;
  const cumulative = CUMULATIVE_GROUPS.has(group);
  let state: unknown[];

  if (entry.status !== "success") {
    // 跳过 / 失败：继承上一行的状态
    state = parseEntries(await readRawLast(db, group));
  } else if (cumulative) {
    // 热点：已有条目按哈希去重并丢弃过期，再并入本次（时间取当前）
    const cutoff = nowSec() - RETAIN_DAYS * 86_400;
    const latest = new Map<string, number>();

    for (const e of parseEntries(await readRawLast(db, group))) {
      const [hash, ts] = String(e).split(":");
      if (!hash) continue;
      const time = ts === undefined ? nowSec() : Number(ts);
      if (time < cutoff) continue;
      latest.set(hash, time);
    }
    for (const id of entry.articleIds ?? []) {
      latest.set(String(id), nowSec());
    }

    state = [...latest].map(([hash, time]) => `${hash}:${time}`);
  } else {
    // article：只存本次推送的文章 id
    state = entry.articleIds ?? [];
  }

  if (cumulative) {
    // 状态只留在最新一行：先把上一行清空，再写入新行
    await db
      .prepare(
        `UPDATE push_logs SET article_ids = ''
         WHERE group_name = ? AND id = (SELECT MAX(id) FROM push_logs WHERE group_name = ?)`,
      )
      .bind(group, group)
      .run();
  }

  const res = await db
    .prepare(
      `INSERT INTO push_logs (article_count, subscriber_count, group_name, status, error_msg, article_ids)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      entry.articleCount,
      entry.subscriberCount,
      group,
      entry.status,
      entry.errorMsg ?? null,
      JSON.stringify(state),
    )
    .run();

  await db
    .prepare(
      `DELETE FROM push_logs
       WHERE group_name = ?
         AND id NOT IN (SELECT id FROM push_logs WHERE group_name = ? ORDER BY id DESC LIMIT ?)`,
    )
    .bind(group, group, KEEP_PER_GROUP)
    .run();

  return res.meta.last_row_id;
}
