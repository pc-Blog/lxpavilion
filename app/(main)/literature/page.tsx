import LiteratureList from "@/app/_components/literature/LiteratureList";
import { literatureMetadata as metadata, breadcrumbSchema } from "@/lib/seo";
import { siteConfig } from "@/lib/siteConfig";

export { metadata };

export default function LiteraturePage() {
  if (!siteConfig.featureLiterature) {
    return (
      <div className="flex-1 w-full mt-28 max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pb-20">
        <div className="rounded-2xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-12 text-center">
          <div className="text-4xl mb-4">📖</div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white mb-2">Literature</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            该功能未启用，请在 <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">lib/siteConfig.ts</code> 中设置 <code className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">featureLiterature: true</code>。
          </p>
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
            { name: "文学创作", path: "/literature" },
          ])),
        }}
      />
      <h1 className="sr-only">{metadata.description}</h1>
      <LiteratureList />
    </>
  );
}
