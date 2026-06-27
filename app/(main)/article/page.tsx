import ArticleListClient from "./ArticleListClient";
import { articleMetadata as metadata, breadcrumbSchema } from "@/lib/seo";

export { metadata };

export default function ArticlePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema([
            { name: "首页", path: "/" },
            { name: "技术文章", path: "/article" },
          ])),
        }}
      />
      <h1 className="sr-only">{metadata.description}</h1>
      <ArticleListClient />
    </>
  );
}
