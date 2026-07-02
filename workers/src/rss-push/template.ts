/**
 * RSS 推送邮件模板 — 处理函数
 *
 * template.html 存完整邮件框架（用 {{POSTS}} 标记文章插入位）
 * 本文件定义单篇文章卡片 + 分隔线的 HTML 片段，组装后替换 {{POSTS}}
 */

import tpl from "./template.html";

export interface Article {
  title: string;
  link: string;
  date: string | null;
  summary: string | null;
  category?: string | null;
  tags?: string[];
}

// ── 单篇文章卡片 ──

const CARD = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
  <tr>
    <td>
      <h3 style="font-family: 'Inter', sans-serif; color: #FFFFFF; font-size: 19px; line-height: 1.35; font-weight: 600; margin: 0 0 8px;">
        <a href="{{LINK}}" target="_blank" style="color: #FFFFFF; text-decoration: none;">{{TITLE}}</a>
      </h3>
      <p style="font-family: 'Inter', sans-serif; color: #9CA3AF; font-size: 12px; margin: 0 0 8px;">{{DATE}}{{CATEGORY}}</p>
      <p style="font-family: 'Inter', sans-serif; color: #9CA3AF; font-size: 12px; margin: 0 0 12px;">{{TAGS}}</p>
      <p style="font-family: 'Inter', sans-serif; color: #D1D5DB; font-size: 14px; line-height: 1.7; margin: 0 0 12px;">{{SUMMARY}}</p>
      <p style="margin: 0;">
        <a href="{{LINK}}" target="_blank" style="color: #8B5CF6; text-decoration: underline; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600;">Read more →</a>
      </p>
    </td>
  </tr>
</table>`;

// ── 文章之间的分隔线 ──

const SEPARATOR = `
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="height: 1px; background-color: #4A4A4A;"></td>
  </tr>
</table>
<div style="height: 20px;"></div>`;

// ── 日期格式化 ──

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

// ── 渲染单篇文章卡片 ──

function renderCard(article: Article): string {
  const summary = article.summary
    ? article.summary.replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 300)
    : "";

  const categoryTag = article.category ? `  ·  ${article.category}` : "";
  const tagsHtml = article.tags?.length
    ? article.tags.slice(0, 3).map(t => `<span style="display: inline-block; padding: 2px 8px; margin: 0 4px 4px 0; border-radius: 10px; background-color: #3A3456; color: #C4B5FD; font-size: 11px;">${t}</span>`).join("")
    : "";

  return CARD
    .replace(/\{\{TITLE\}\}/g, article.title)
    .replace(/\{\{LINK\}\}/g, article.link)
    .replace(/\{\{DATE\}\}/g, formatDate(article.date))
    .replace(/\{\{CATEGORY\}\}/g, categoryTag)
    .replace(/\{\{TAGS\}\}/g, tagsHtml)
    .replace(/\{\{SUMMARY\}\}/g, summary);
}

// ── 公开渲染函数 ──

export function renderRssEmail(articles: Article[]): string {
  const cardsHtml = articles
    .map((article, i) => {
      const card = renderCard(article);
      return i === articles.length - 1 ? card : card + SEPARATOR;
    })
    .join("\n");

  return tpl.replace("{{POSTS}}", cardsHtml);
}
