import AboutClient from "./AboutClient";
import { aboutMetadata as metadata, personSchema, breadcrumbSchema, SITE_URL } from "@/lib/seo";

export { metadata };

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema(SITE_URL)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema([
            { name: "首页", path: "/" },
            { name: "关于博主", path: "/about" },
          ])),
        }}
      />
      <h1 className="sr-only">{metadata.description}</h1>
      <AboutClient />
    </>
  );
}
