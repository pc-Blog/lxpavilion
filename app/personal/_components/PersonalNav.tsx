"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const HOME_ITEM = { label: "返回主页", href: "/", icon: "🏠" } as const;

const NAV_ITEMS = [
  { label: "仪表盘", href: "/personal", icon: "📖" },
  { label: "提交记录", href: "/personal/commits", icon: "📊" },
  { label: "学习历程", href: "/personal/timeline", icon: "🛠️" },
];

export default function PersonalNav() {
  const pathname = usePathname();

  return (
    <div className="fixed right-4 top-1/2 z-50 -translate-y-1/2">
      <div className="flex flex-col gap-2 rounded-2xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-lg p-2">
        {/* 返回主页 */}
        <Link
          href={HOME_ITEM.href}
          className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-all duration-300 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <span className="text-lg">{HOME_ITEM.icon}</span>
          <span className="text-[10px] font-bold leading-tight text-center">
            {HOME_ITEM.label}
          </span>
        </Link>

        {/* 分隔线 */}
        <div className="h-px bg-slate-200 dark:bg-slate-700 mx-2" />

        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl transition-all duration-300 ${
                isActive
                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[10px] font-bold leading-tight text-center">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
