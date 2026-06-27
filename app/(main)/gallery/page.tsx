import GalleryClient from "./GalleryClient";
import { galleryMetadata as metadata, breadcrumbSchema } from "@/lib/seo";

export { metadata };

export default function GalleryPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema([
            { name: "首页", path: "/" },
            { name: "摄影图库", path: "/gallery" },
          ])),
        }}
      />
      <h1 className="sr-only">{metadata.description}</h1>
      <GalleryClient />
    </>
  );
}
