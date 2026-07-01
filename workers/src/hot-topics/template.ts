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
      <h2 style="font-family: 'Inter', sans-serif; color: #C4B5FD; font-size: 15px; line-height: 1.4; font-weight: 600; margin: 0;">📌 ${keyword}</h2>
    </td>
  </tr>
</table>`;
}

// ── 单条热点 ──

const HOT_CARD = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
  <tr>
    <td>
      <p style="font-family: 'Inter', sans-serif; color: #C0C0C0; font-size: 12px; margin: 0 0 2px;">#{{RANK}}  {{SOURCE}}<span style="float: right;">{{TIME}}</span></p>
      <h3 style="font-family: 'Inter', sans-serif; color: #FFFFFF; font-size: 16px; line-height: 1.35; font-weight: normal; margin: 0 0 4px;">
        <a href="{{URL}}" target="_blank" style="color: #FFFFFF; text-decoration: none;">{{TITLE}}</a>
      </h3>
      <p style="font-family: 'Inter', sans-serif; color: #A0A0A0; font-size: 13px; line-height: 1.6; margin: 0 0 4px;">{{SUMMARY}}</p>
      {{PERSPECTIVES}}
      <p style="margin: 4px 0 0;">
        <a href="{{URL}}" target="_blank" style="color: #8B5CF6; text-decoration: underline; font-family: 'Inter', sans-serif; font-size: 13px;">查看原文 →</a>
      </p>
    </td>
  </tr>
</table>`;

// ── 多角度观点（扁平样式） ──

function renderPerspectives(perspectives: { stance: string; summary: string }[]): string {
  if (!perspectives || perspectives.length === 0) return "";
  return perspectives
    .map(
      (p) => `
    <div style="margin: 2px 0 0;">
      <span style="color: #C4B5FD; font-size: 12px; font-family: 'Inter', sans-serif;">${escHtml(p.stance)}</span>
      <span style="color: #A0A0A0; font-size: 12px; font-family: 'Inter', sans-serif;"> — ${escHtml(p.summary)}</span>
    </div>`,
    )
    .join("");
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
