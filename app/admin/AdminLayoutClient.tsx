"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin" },
  { label: "Articles", href: "/admin/article" },
  { label: "Projects", href: "/admin/project" },
  { label: "Timeline", href: "/admin/timeline" },
  { label: "Skills", href: "/admin/skill" },
  { label: "Chatters", href: "/admin/chatter" },
  { label: "Albums", href: "/admin/album" },
  { label: "Friend Links", href: "/admin/friend-link" },
  { label: "Categories", href: "/admin/category" },
  { label: "Tags", href: "/admin/tag" },
  { label: "Tech", href: "/admin/tech" },
  { label: "Media", href: "/admin/media" },
  { label: "About", href: "/admin/about" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isStatic, setIsStatic] = useState(false);

  useEffect(() => {
    setIsStatic(process.env.NEXT_PUBLIC_IS_STATIC === "true");
  }, []);

  if (isStatic) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
        <h1 className="text-2xl font-black text-slate-800 dark:text-white">管理面板不可用</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
          管理端仅在本地开发环境中可用。请通过 Docker 或 dev 模式启动应用后访问。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <aside className="w-56 glass-card !rounded-none border-r border-slate-200 dark:border-slate-700 p-6 flex-shrink-0 overflow-y-auto">
        <Link href="/admin" className="text-lg font-black text-slate-900 dark:text-white font-[family-name:var(--font-geist-sans)] block">Admin</Link>
        <Link href="/" className="text-xs text-slate-400 hover:text-indigo-500 transition-colors block mb-6 mt-1 border-b border-slate-200 dark:border-slate-700 pb-3">
          ← Back to Site
        </Link>
        <nav className="flex flex-col gap-0.5 text-sm">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-lg transition-colors ${
                  active
                    ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold"
                    : "text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white/50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 p-8 flex flex-col min-h-0">{children}</main>
    </div>
  );
}
