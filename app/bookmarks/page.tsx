import BookmarksClient from "./BookmarksClient";
import { bookmarksMetadata as metadata } from "@/lib/seo";

export { metadata };

export default function BookmarksPage() {
  return <BookmarksClient />;
}
