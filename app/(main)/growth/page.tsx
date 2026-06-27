import { growthMetadata as metadata, breadcrumbSchema } from "@/lib/seo";
import GrowthClient from "./GrowthClient";

export { metadata };

export default function GrowthPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema([
            { name: "首页", path: "/" },
            { name: "博客成长", path: "/growth" },
          ])),
        }}
      />
      <h1 className="sr-only">{metadata.description}</h1>
      <GrowthClient />
    </>
  );
}
