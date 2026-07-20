import TimelineClient from "./TimelineClient";
import { timelineMetadata as metadata } from "@/lib/seo";

export { metadata };

export default function TimelinePage() {
  return (
    <div className="flex-1 w-full min-h-screen py-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-10">
      <TimelineClient />
    </div>
  );
}
