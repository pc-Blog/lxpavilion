/**
 * 时间格式化工具。
 *
 * D1 统一以 "yyyy-MM-dd HH:mm:ss"（UTC，datetime('now') 的原生格式）存储，
 * 这是数据库里唯一的格式，不存在第二种。
 *
 * 邮件/界面展示统一按东八区输出，只此一种展示格式。
 */

/** 东八区相对 UTC 的偏移毫秒数 */
const CST_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 两位补零 */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * 格式化为东八区的 "yyyy-MM-dd HH:mm"。
 *
 * @param d 待格式化的时间点
 * @returns 东八区可读时间，如 "2026-09-27 05:30"
 */
export function formatCst(d: Date): string {
  const t = new Date(d.getTime() + CST_OFFSET_MS);
  return (
    `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())} ` +
    `${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}`
  );
}

/**
 * 当前时间的东八区表示，等价于 `formatCst(new Date())`。
 *
 * @returns 东八区可读时间，如 "2026-09-27 05:30"
 */
export function nowCst(): string {
  return formatCst(new Date());
}
