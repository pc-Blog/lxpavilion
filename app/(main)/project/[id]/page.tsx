import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import ProjectDetailClient from "./ProjectDetailClient";
import { OG_TITLE_SUFFIX, defaultOgImage, breadcrumbSchema, jsonLdSchema, SITE_URL } from "@/lib/seo";

function readProject(id: string) {
  try {
    const p = path.join(process.cwd(), "public", "data", "projects", `${id}.json`);
    return JSON.parse(fs.readFileSync(p, "utf-8")) as { name: string; summary?: string; coverImage?: string; content?: string };
  } catch { return null; }
}

function getProjectDate(id: string): string | undefined {
  try {
    const p = path.join(process.cwd(), "public", "data", "projects.json");
    const raw = fs.readFileSync(p, "utf-8");
    const data = JSON.parse(raw) as { rows: { id: number; createTime?: string }[] };
    return data.rows?.find(a => String(a.id) === id)?.createTime;
  } catch { return undefined; }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = readProject(id);
  if (!data) return { title: "Project" };
  const imgUrl = data.coverImage || defaultOgImage;
  const images = [{ url: imgUrl.startsWith("http") ? imgUrl : `${SITE_URL}${imgUrl}`, width: 1200, height: 630 }];
  return {
    title: data.name,
    description: data.summary || "",
    alternates: {
      canonical: `/project/${id}/`,
    },
    openGraph: {
      title: `${data.name} ${OG_TITLE_SUFFIX}`,
      description: data.summary || "",
      images,
    },
  };
}

export function generateStaticParams() {
  const p = path.join(process.cwd(), "public", "data", "projects.json");
  if (!fs.existsSync(p)) return [];
  const data = JSON.parse(fs.readFileSync(p, "utf-8")) as { rows: { id: number }[] };
  return (data.rows || []).map((a) => ({ id: String(a.id) }));
}

export default async function ProjectDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const data = readProject(id);
  const projectDate = getProjectDate(id);
  const coverUrl = data?.coverImage
    ? (data.coverImage.startsWith("http") ? data.coverImage : `${SITE_URL}${data.coverImage}`)
    : undefined;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema([
            { name: "首页", path: "/" },
            { name: "项目实践", path: "/project" },
            { name: data?.name || "项目", path: `/project/${id}` },
          ])),
        }}
      />
      {data && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLdSchema("CreativeWork", data.name, data.summary, projectDate, coverUrl)),
          }}
        />
      )}
      <ProjectDetailClient params={props.params} projectName={data?.name || ""} initialContent={data?.content || ""} />
    </>
  );
}
