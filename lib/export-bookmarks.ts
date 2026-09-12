import type { Bookmark, BookmarkCategory } from "@/lib/types";

/**
 * 生成浏览器可直接导入的书签文件（Edge / Chrome / Firefox 通用）。
 *
 * 格式为 Netscape Bookmark File Format：
 *   - 首行必须是 <!DOCTYPE NETSCAPE-Bookmark-file-1>，否则浏览器不识别
 *   - 文件夹写成 <DT><H3>名称</H3>，紧跟一层 <DL><p>…</DL><p>
 *   - 书签写成 <DT><A HREF="地址" ADD_DATE="秒级时间戳">名称</A>
 *   - 不写 ICON 属性：导入后浏览器会自行解析站点 favicon，
 *     比内嵌 base64 更省体积，也能避开跨域取图的限制
 */

const FILE_HEADER = [
  "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
  "<!-- This is an automatically generated file.",
  "     It will be read and overwritten.",
  "     DO NOT EDIT! -->",
  '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
  "<TITLE>Bookmarks</TITLE>",
  "<H1>Bookmarks</H1>",
  "<DL><p>",
].join("\n");

const FILE_FOOTER = "</DL><p>";
const INDENT = "    ";

/**
 * 收藏夹栏标记。
 * Edge / Chrome 导入 HTML 时只认这个属性：带 PERSONAL_TOOLBAR_FOLDER="true"
 * 的那一段会进「收藏夹栏」，其余内容一律进「其他收藏夹」。
 * 一级分类直接铺在该段下面，导入后就是收藏夹栏上一排平铺的文件夹。
 */
const TOOLBAR_FOLDER_NAME = "收藏夹栏";

/** HTML 转义：名称或地址里出现 & < > " 会破坏文件结构 */
function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 浏览器书签格式要求的是秒级 Unix 时间戳 */
function toUnixSeconds(time?: string): number {
  const now = Math.floor(Date.now() / 1000);
  if (!time) return now;
  const ms = Date.parse(time);
  return Number.isNaN(ms) ? now : Math.floor(ms / 1000);
}

/** 排序：sortOrder 升序，其次 id 升序，与站内展示顺序保持一致 */
function bySortOrder(
  a: { sortOrder?: number; id?: number },
  b: { sortOrder?: number; id?: number }
): number {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0);
}

function renderLink(bookmark: Bookmark, depth: number): string {
  const pad = INDENT.repeat(depth);
  const addDate = toUnixSeconds(bookmark.createTime);
  return `${pad}<DT><A HREF="${escapeHtml(bookmark.url)}" ADD_DATE="${addDate}">${escapeHtml(bookmark.name)}</A>`;
}

function renderFolder(name: string, children: string[], depth: number, createTime?: string): string {
  const pad = INDENT.repeat(depth);
  return [
    `${pad}<DT><H3 ADD_DATE="${toUnixSeconds(createTime)}">${escapeHtml(name)}</H3>`,
    `${pad}<DL><p>`,
    ...children,
    `${pad}</DL><p>`,
  ].join("\n");
}

/**
 * 把分类树 + 书签列表渲染成 Netscape 书签 HTML。
 * 一级分类平铺在「收藏夹栏」段下（导入后直接出现在收藏夹栏），
 * 二级分类为嵌套文件夹，未分类的收进「未分类」文件夹。
 */
export function buildEdgeBookmarksHtml(
  categories: BookmarkCategory[],
  bookmarks: Bookmark[]
): string {
  const roots = categories.filter((c) => !c.parentId).sort(bySortOrder);
  const knownIds = new Set(
    categories.map((c) => c.id).filter((id): id is number => id != null)
  );

  // 收藏夹栏里的条目：一级分类按顺序平铺
  const toolbarChildren: string[] = [];

  for (const root of roots) {
    const rootId = root.id;
    if (rootId == null) continue;

    const children: string[] = [];

    for (const sub of categories.filter((c) => c.parentId === rootId).sort(bySortOrder)) {
      const items = bookmarks.filter((b) => b.categoryId === sub.id);
      if (!items.length) continue;
      children.push(
        renderFolder(sub.name, items.map((b) => renderLink(b, 4)), 3, sub.createTime)
      );
    }

    // 直接挂在一级分类下、没有二级归属的书签
    for (const b of bookmarks.filter((b) => b.categoryId === rootId)) {
      children.push(renderLink(b, 3));
    }

    if (!children.length) continue;
    toolbarChildren.push(renderFolder(root.name, children, 2, root.createTime));
  }

  // 未分类，或指向已被删除分类的书签
  const orphans = bookmarks.filter((b) => b.categoryId == null || !knownIds.has(b.categoryId));
  if (orphans.length) {
    toolbarChildren.push(renderFolder("未分类", orphans.map((b) => renderLink(b, 3)), 2));
  }

  const pad = INDENT.repeat(1);
  return [
    FILE_HEADER,
    `${pad}<DT><H3 PERSONAL_TOOLBAR_FOLDER="true">${escapeHtml(TOOLBAR_FOLDER_NAME)}</H3>`,
    `${pad}<DL><p>`,
    ...toolbarChildren,
    `${pad}</DL><p>`,
    FILE_FOOTER,
  ].join("\n") + "\n";
}

/** 触发浏览器下载 `网址导航_YYYY-MM-DD.html` */
export function downloadEdgeBookmarks(
  categories: BookmarkCategory[],
  bookmarks: Bookmark[]
): void {
  const html = buildEdgeBookmarksHtml(categories, bookmarks);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `网址导航_${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
