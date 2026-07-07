import { growthMetadata as metadata, breadcrumbSchema } from "@/lib/seo";
import GrowthClient from "./GrowthClient";
import { siteConfig } from "@/lib/siteConfig";

export { metadata };

export default function GrowthPage() {
  if (!siteConfig.featureGrowth) {
    return (
      <div className="flex-1 w-full mt-28 max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pb-20">
        <div className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-12 text-center">
          <div className="text-4xl mb-4">🌱</div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white mb-2">Growth</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">该功能未启用。</p>
        </div>
      </div>
    );
  }

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
