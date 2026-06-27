import ChatterClient from "./ChatterClient";
import { chatterMetadata as metadata, breadcrumbSchema } from "@/lib/seo";

export { metadata };

export default function ChatterPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema([
            { name: "首页", path: "/" },
            { name: "说说", path: "/chatter" },
          ])),
        }}
      />
      <h1 className="sr-only">{metadata.description}</h1>
      <ChatterClient />
    </>
  );
}