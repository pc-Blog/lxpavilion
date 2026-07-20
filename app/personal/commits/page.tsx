import GrowthClient from "./GrowthClient";
import { growthMetadata as metadata } from "@/lib/seo";

export { metadata };

export default function CommitsPage() {
  return (
    <div className="flex-1 w-full min-h-screen py-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-10">
      <GrowthClient />
    </div>
  );
}
