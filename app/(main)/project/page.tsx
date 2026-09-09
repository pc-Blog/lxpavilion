import ProjectList from "@/app/_components/project/ProjectList";
import { projectMetadata as metadata, breadcrumbSchema } from "@/lib/seo";

export { metadata };

export default function ProjectPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema([
            { name: "首页", path: "/" },
            { name: "项目实践", path: "/project" },
          ])),
        }}
      />
      <ProjectList />
    </>
  );
}