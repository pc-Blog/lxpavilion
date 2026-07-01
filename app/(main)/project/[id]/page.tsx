import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import ProjectDetailClient from "./ProjectDetailClient";
import { OG_TITLE_SUFFIX, defaultOgImage, breadcrumbSchema, SITE_URL } from "@/lib/seo";

function readProject(id: string) {
  try {
    const p = path.join(process.cwd(), "public", "data", "projects", `${id}.json`);
    return JSON.parse(fs.readFileSync(p, "utf-8")) as { name: string; summary?: string; coverImage?: string; content?: string };
  } catch { return null; }
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
      <ProjectDetailClient params={props.params} projectName={data?.name || ""} initialContent={data?.content || ""} />
    </>
  );
}
