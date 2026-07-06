import type { MetadataRoute } from "next";
import { SITE_URL as BASE_URL } from "@/lib/seo";
import fs from "fs";
import path from "path";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/about/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/article/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/project/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/literature/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/timeline/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/gallery/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/chatter/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/friends/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/analytics/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/growth/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];

  const dataDir = path.join(process.cwd(), "public", "data");

  // Articles — /article/{id}/
  try {
    const raw = fs.readFileSync(path.join(dataDir, "articles.json"), "utf-8");
    const data = JSON.parse(raw) as { rows: { id: number; createdAt?: string }[] };
    for (const article of data.rows || []) {
      entries.push({
        url: `${BASE_URL}/article/${article.id}/`,
        lastModified: article.createdAt ? new Date(article.createdAt) : new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch {
    // data files not available — static routes only
  }

  // Projects — /project/{id}/
  try {
    const raw = fs.readFileSync(path.join(dataDir, "projects.json"), "utf-8");
    const data = JSON.parse(raw) as { rows: { id: number; createTime?: string }[] };
    for (const project of data.rows || []) {
      entries.push({
        url: `${BASE_URL}/project/${project.id}/`,
        lastModified: project.createTime ? new Date(project.createTime) : new Date(),
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  } catch {
    // data files not available — static routes only
  }

  // Literature — /literature/{id}/
  try {
    const raw = fs.readFileSync(path.join(dataDir, "op-articles.json"), "utf-8");
    const data = JSON.parse(raw) as { rows: { articles: { id: number; writtenAt?: string }[] }[] };
    for (const tag of data.rows || []) {
      for (const article of tag.articles || []) {
        if (article.id == null) continue;
        entries.push({
          url: `${BASE_URL}/literature/${article.id}/`,
          lastModified: article.writtenAt ? new Date(article.writtenAt) : new Date(),
          changeFrequency: "monthly",
          priority: 0.6,
        });
      }
    }
  } catch {
    // data files not available — static routes only
  }

  return entries;
}
