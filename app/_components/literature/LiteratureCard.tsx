import Link from "next/link";
import type { Literature } from "@/lib/types";

interface LiteratureCardProps {
  item: Literature;
  /** 分类名（列表已不再返回 categoryName，由父组件映射后传入） */
  categoryName?: string;
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

export default function LiteratureCard({ item, categoryName }: LiteratureCardProps) {
  const date = formatDate(item.writtenAt);

  return (
    <Link href={`/literature/${item.id}`} className="block group">
      <article className="relative rounded-xl bg-indigo-50/30 dark:bg-indigo-900/10 p-5 md:p-6 transition-all duration-500 hover:bg-indigo-100/40 dark:hover:bg-indigo-800/20 border-l-[3px] border-indigo-300/40 dark:border-indigo-600/30 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-indigo-400 dark:hover:border-indigo-500">
        <div className="text-4xl md:text-5xl text-indigo-300/40 dark:text-indigo-500/30 leading-none mb-3 select-none">
          &ldquo;
        </div>

        {item.content && (
          <p className="text-sm md:text-base leading-relaxed text-center text-slate-600 dark:text-slate-300 line-clamp-4 whitespace-pre-line">
            {item.content}
          </p>
        )}

        <div className="text-right text-4xl md:text-5xl text-indigo-300/40 dark:text-indigo-500/30 leading-none mt-2 select-none">
          &rdquo;
        </div>

        <p className="text-right text-xs text-slate-400 dark:text-slate-500 mt-1 transition-colors duration-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-300">
          —— {item.title}
          {date && <> · {date}</>}
        </p>

        {(categoryName || item.weather) && (
          <p className="text-right text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 flex items-center justify-end gap-1.5">
            {categoryName && (
              <span className="px-1.5 py-0.5 rounded bg-indigo-50/70 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400">
                {categoryName}
              </span>
            )}
            {item.weather && <span>{item.weather}</span>}
          </p>
        )}
      </article>
    </Link>
  );
}
