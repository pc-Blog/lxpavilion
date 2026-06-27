import FriendsBoard from "./FriendsBoard";
import { friendsMetadata as metadata, breadcrumbSchema } from "@/lib/seo";

export { metadata };

export default function FriendsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema([
            { name: "首页", path: "/" },
            { name: "友情链接", path: "/friends" },
          ])),
        }}
      />
      <h1 className="sr-only">{metadata.description}</h1>
      <FriendsBoard />
    </>
  );
}
