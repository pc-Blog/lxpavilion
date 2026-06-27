import LiteratureList from "@/app/_components/literature/LiteratureList";
import { literatureMetadata as metadata, breadcrumbSchema } from "@/lib/seo";

export { metadata };

export default function LiteraturePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema([
            { name: "首页", path: "/" },
            { name: "文学创作", path: "/literature" },
          ])),
        }}
      />
      <h1 className="sr-only">{metadata.description}</h1>
      <LiteratureList />
    </>
  );
}
