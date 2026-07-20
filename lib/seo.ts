import type { Metadata } from "next";
import { siteConfig } from "./siteConfig";

// ── Helper ──────────────────────────────────────────
function ogImg(url: string) {
  return [{ url, width: 1200, height: 630 } as const];
}

// ── Shared constants ────────────────────────────────
/** 站点默认 OG 图片 — 首页及未单独配置的页面使用 */
export const defaultOgImage = "/seo/logo.jpeg";

/** 站点关键词 */
export const SITE_KEYWORDS = [
  // ── 品牌标识 ──
  "栏轩阁",
  "lxpavilion",
  "ppc",
  "个人博客",
  "技术博客",

  // ── 后端与微服务 ──
  "后端开发",
  "Java",
  "Spring Boot",
  "Spring Cloud Alibaba",
  "微服务架构",
  "MyBatis-Plus",
  "RabbitMQ",

  // ── 云原生与 DevOps ──
  "云原生",
  "Docker",
  "Kubernetes",
  "KubeSphere",
  "DevOps",
  "CI/CD",

  // ── AI 与 RAG ──
  "AI 应用开发",
  "RAG",
  "Spring AI",
  "向量检索",
  "Claude Code",

  // ── 数据库与缓存 ──
  "MySQL",
  "Redis",
  "Elasticsearch",
  "OpenGauss",

  // ── 全栈与前端 ──
  "全栈开发",
  "Vue 3",
  "TypeScript",
  "Next.js",

  // ── Cloudflare ──
  "Cloudflare",
  "Cloudflare Workers",

  // ── 技术写作与 SEO ──
  "学习笔记",
  "项目实践",
  "Bing SEO",
  "IndexNow",
  "MailerLite",
];

/** OG 基础字段 — layout 和 meta() 共用 */
const OG_BASE = {
  siteName: siteConfig.title,
  type: "website" as const,
  locale: "zh_CN",
};

/** OG title suffix appended to page titles */
export const OG_TITLE_SUFFIX = `| ${siteConfig.title}`;

/** 站点 URL — sitemap / feed / layout 共用 */
export const SITE_URL = `https://${siteConfig.blog.replace(/^https?:\/\//, "")}`;


// ── Helper to build Metadata ────────────────────────
function meta(title: string, description: string, image: string, canonicalPath?: string): Metadata {
  return {
    title,
    description,
    ...(canonicalPath ? { alternates: { canonical: `${SITE_URL}${canonicalPath}` } } : {}),
    openGraph: {
      ...OG_BASE,
      title: `${title} ${OG_TITLE_SUFFIX}`,
      description,
      images: ogImg(image),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} ${OG_TITLE_SUFFIX}`,
      description,
      images: [image],
    },
  };
}

// ══════════════════════════════════════════════════════
// JSON-LD 结构化数据
// ══════════════════════════════════════════════════════

/** WebSite schema — 首页使用 */
export function websiteSchema(url?: string) {
  const siteUrl = url || (() => {
    const raw = siteConfig.blog.replace(/^https?:\/\//, "");
    return `https://${raw}`;
  })();

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.title,
    alternateName: siteConfig.navTitle,
    description: siteConfig.seoDescription,
    url: siteUrl,
  };
}

/** JSON-LD schema — 详情页使用 */
export function jsonLdSchema(
  type: "Article" | "CreativeWork",
  title: string,
  description?: string,
  date?: string,
  image?: string,
  updatedDate?: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": type,
    name: title,
    headline: title,
    description: description || undefined,
    datePublished: date || undefined,
    dateCreated: date || undefined,
    dateModified: updatedDate || undefined,
    author: { "@type": "Person", name: siteConfig.authorName },
    publisher: {
      "@type": "Organization",
      name: siteConfig.navTitle,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/seo/logo.jpeg`,
      },
    },
    image: image || undefined,
  };
}

/** Person schema — 关于页使用 */
export function personSchema(url?: string) {
  const sameAs = [
    siteConfig.github && `https://${siteConfig.github}`,
    siteConfig.gitee && `https://${siteConfig.gitee}`,
    siteConfig.juejin && `https://${siteConfig.juejin}`,
    siteConfig.csdn && `https://${siteConfig.csdn}`,
    siteConfig.cnblogs && `https://${siteConfig.cnblogs}`,
  ].filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: siteConfig.authorName,
    description: siteConfig.seoDescription,
    url: url || `https://${siteConfig.blog.replace(/^https?:\/\//, "")}`,
    image: siteConfig.avatarUrl,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  };
}

/** BreadcrumbList JSON-LD */
export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

// ══════════════════════════════════════════════════════
// 页面 SEO 配置 — 统一在此处修改，全局生效
// ══════════════════════════════════════════════════════

const SEO_IMAGE = "/seo/logo.jpeg";
/** 文章列表页 */
export const articleMetadata: Metadata = meta(
  "技术文章与开发笔记",
  "精选原创技术文章与开发笔记，覆盖Web前端、全栈开发与编程实践。深度解析JavaScript、React、Next.js等技术栈，分享项目实战经验与问题解决方案。",
  SEO_IMAGE,
  "/article",
);

/** 项目列表页 */
export const projectMetadata: Metadata = meta(
  "项目实践与开源探索",
  "收录开源项目与技术实验，覆盖全栈开发、前端框架与工具库。分享实战项目与趣味探索，完整呈现从需求构思、代码开发到上线落地的全流程。",
  SEO_IMAGE,
  "/project",
);

/** 学习历程页 */
export const timelineMetadata: Metadata = meta(
  "学习历程与技术成长",
  "记录编程从入门到进阶的完整成长路径，整理系统化学习笔记、技能清单与关键里程碑，见证长期坚持下的技术沉淀与能力提升轨迹。",
  SEO_IMAGE,
  "/personal/timeline",
);

/** 文学创作页 */
export const literatureMetadata: Metadata = meta(
  "文学创作与随笔",
  "收录原创诗歌、散文与生活随笔，用文字记录日常感悟与所思所想。跳出代码的理性世界，以人文视角观察生活，分享阅读与写作心得。",
  SEO_IMAGE,
  "/literature",
);

/** 摄影图库页 */
export const galleryMetadata: Metadata = meta(
  "摄影图库与相册",
  "个人原创摄影作品集与生活相册，用镜头定格旅途风光、日常点滴与美好瞬间，分享每一张照片背后的视觉故事与情绪记忆。",
  SEO_IMAGE,
  "/gallery",
);

/** 友情链接页 */
export const friendsMetadata: Metadata = meta(
  "友情链接",
  "博客友情链接与技术交流矩阵，汇聚圈内优质独立博主与技术站点。以文会友、交流学习，共建开放互助的技术创作者交流圈。",
  SEO_IMAGE,
  "/friends",
);

/** 关于页 */
export const aboutMetadata: Metadata = meta(
  "关于博主",
  "栏轩阁博主个人介绍页，涵盖技术栈详情、成长经历、社交账号与联系方式。欢迎各路技术同好交流探讨、资源互换与项目合作。",
  SEO_IMAGE,
  "/about",
);

/** 说说页 */
export const chatterMetadata: Metadata = meta(
  "说说与杂谈",
  "日常动态、灵感随笔与生活杂谈，记录工作与生活中的碎片化思考。分享技术感悟、生活碎片与转瞬即逝的创意灵感与随想。",
  SEO_IMAGE,
  "/chatter",
);

/** 统计页 */
export const analyticsMetadata: Metadata = meta(
  "网站统计",
  "栏轩阁站点公开数据统计中心，可实时查看网站流量、访客数据与访问趋势，监控站点运行状态与各项核心性能指标。",
  SEO_IMAGE,
  "/analytics",
);

/** 网站导航页 */
export const bookmarksMetadata: Metadata = meta(
  "网站导航",
  "栏轩阁网站导航页，分类整理优质网站资源，涵盖 AI 工具、开发平台、文档图片处理、下载工具等精选收藏，一键直达常用站点。",
  SEO_IMAGE,
  "/bookmarks",
);

/** 成长记录页 */
export const growthMetadata: Metadata = meta(
  "博客成长记录",
  "全程追踪栏轩阁博客的发展历程，记录每一次代码提交、功能迭代与版本更新，见证站点逐步完善的技术演进与成长轨迹。",
  SEO_IMAGE,
  "/personal/commits",
);
