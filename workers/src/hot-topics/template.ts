/**
 * 热点推送邮件模板 — 处理函数
 *
 * 风格与 rss-push 保持一致（扁平文字，无卡中卡）
 */

import tpl from "./template.html";

export interface HotItem {
  rank: number;
  title: string;
  url: string;
  summary: string;
  source: string;
  published_time: string;
  keyword: string;
  perspectives: { stance: string; summary: string }[];
  urlHash: string;
}

// ── 关键词组标题 ──

function renderGroupHeader(keyword: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 8px;">
  <tr>
    <td style="padding-bottom: 4px; border-bottom: 1px solid #4A4A4A;">
      <h2 style="font-family: 'Inter', sans-serif; color: #C4B5FD; font-size: 16px; line-height: 1.4; font-weight: 700; margin: 0; letter-spacing: 0.5px;">📌 ${keyword}</h2>
    </td>
  </tr>
</table>`;
}

// ── 单条热点 ──

const HOT_CARD = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
  <tr>
    <td>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="36" valign="top" style="padding-top: 2px;">
            <span style="display: inline-block; background: #8B5CF6; color: #FFFFFF; font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">#{{RANK}}</span>
          </td>
          <td valign="top">
            <span style="font-family: 'Inter', sans-serif; color: #9CA3AF; font-size: 11px;">{{SOURCE}}</span>
            <span style="font-family: 'Inter', sans-serif; color: #6B7280; font-size: 11px; float: right;">{{TIME}}</span>
          </td>
        </tr>
      </table>
      <h3 style="font-family: 'Inter', sans-serif; color: #FFFFFF; font-size: 17px; line-height: 1.4; font-weight: 600; margin: 6px 0 8px;">
        <a href="{{URL}}" target="_blank" style="color: #FFFFFF; text-decoration: none;">{{TITLE}}</a>
      </h3>
      <p style="font-family: 'Inter', sans-serif; color: #D1D5DB; font-size: 13px; line-height: 1.7; margin: 0 0 10px;">{{SUMMARY}}</p>
      {{PERSPECTIVES}}
      <p style="margin: 8px 0 0;">
        <a href="{{URL}}" target="_blank" style="color: #8B5CF6; text-decoration: underline; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;">查看原文 →</a>
      </p>
    </td>
  </tr>
</table>`;

// ── 多角度观点（扁平样式） ──

function renderPerspectives(perspectives: { stance: string; summary: string }[]): string {
  if (!perspectives || perspectives.length === 0) return "";
  const items = perspectives
    .map(
      (p) => `
            <div style="margin: 0 0 8px;">
              <span style="display: inline-block; background: rgba(139, 92, 246, 0.15); color: #C4B5FD; font-size: 11px; font-family: 'Inter', sans-serif; font-weight: 600; padding: 1px 6px; border-radius: 3px; margin-bottom: 2px;">${escHtml(p.stance)}</span>
              <span style="color: #9CA3AF; font-size: 12px; font-family: 'Inter', sans-serif; display: block; margin-top: 2px;">${escHtml(p.summary)}</span>
            </div>`,
    )
    .join("");

  return `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 4px;">
          <tr>
            <td style="padding: 8px 0 0 12px; border-left: 2px solid rgba(139, 92, 246, 0.3);">
              ${items}
            </td>
          </tr>
        </table>`;
}

// ── HTML 转义 ──

function escHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── 渲染单条热点 ──

function renderCard(item: HotItem): string {
  const persHtml = renderPerspectives(item.perspectives);
  const summary = item.summary ? escHtml(item.summary).slice(0, 200) : "";
  const time = item.published_time || "";
  const source = escHtml(item.source || "");
  const title = escHtml(item.title);

  return HOT_CARD
    .replace(/\{\{RANK\}\}/g, String(item.rank))
    .replace(/\{\{TITLE\}\}/g, title)
    .replace(/\{\{URL\}\}/g, item.url)
    .replace(/\{\{SOURCE\}\}/g, source)
    .replace(/\{\{TIME\}\}/g, time)
    .replace(/\{\{SUMMARY\}\}/g, summary)
    .replace("{{PERSPECTIVES}}", persHtml);
}

// ── 分隔线（关键词组之间） ──

const GROUP_SEPARATOR = `
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="height: 1px; background-color: #4A4A4A;"></td>
  </tr>
</table>
<div style="height: 16px;"></div>`;

// ── 公开渲染函数 ──

export function renderHotEmail(
  groups: { keyword: string; items: HotItem[] }[],
  totalCount: number,
  keywordCount: number,
  reportDate: string,
): string {
  const blocks: string[] = [];

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    if (group.items.length === 0) continue;

    if (gi > 0) blocks.push(GROUP_SEPARATOR);
    blocks.push(renderGroupHeader(group.keyword));

    for (const item of group.items) {
      blocks.push(renderCard(item));
    }
  }

  const postsHtml = blocks.join("\n");
  const summary = `本期共 ${totalCount} 条热点，覆盖 ${keywordCount} 个技术领域 · ${reportDate}`;

  return tpl
    .replace("{{SUMMARY}}", summary)
    .replace("{{POSTS}}", postsHtml);
}
