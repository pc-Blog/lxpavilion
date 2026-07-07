"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  FolderKanban,
  Clock,
  Wrench,
  MessageCircle,
  Image,
  Link as LinkIcon,
  Tags,
  Hash,
  Monitor,
  HardDrive,
  Upload,
  Info,
  Database,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, tooltip: "控制台" },
  { label: "Articles", href: "/admin/article", icon: FileText, tooltip: "文章管理" },
  { label: "Projects", href: "/admin/project", icon: FolderKanban, tooltip: "项目管理" },
  { label: "Timeline", href: "/admin/timeline", icon: Clock, tooltip: "时间线管理" },
  { label: "Skills", href: "/admin/skill", icon: Wrench, tooltip: "技能管理" },
  { label: "Chatters", href: "/admin/chatter", icon: MessageCircle, tooltip: "说说管理" },
  { label: "Albums", href: "/admin/album", icon: Image, tooltip: "相册管理" },
  { label: "Friend Links", href: "/admin/friend-link", icon: LinkIcon, tooltip: "友链管理" },
  { label: "Categories", href: "/admin/category", icon: Tags, tooltip: "分类管理" },
  { label: "Tags", href: "/admin/tag", icon: Hash, tooltip: "标签管理" },
  { label: "Tech", href: "/admin/tech", icon: Monitor, tooltip: "技术栈管理" },
  { label: "Media", href: "/admin/media", icon: HardDrive, tooltip: "媒体资源" },
  { label: "Deploys", href: "/admin/deploy", icon: Upload, tooltip: "部署管理" },
  { label: "Sync Data", href: "/admin/sync-data", icon: Database, tooltip: "数据同步" },
  { label: "About", href: "/admin/about", icon: Info, tooltip: "关于页面" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isStatic, setIsStatic] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredTooltip, setHoveredTooltip] = useState<{ text: string; rect: DOMRect } | null>(null);

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
      <aside
        className={`${
          collapsed ? "w-16" : "w-56"
        } glass-card !rounded-none border-r border-slate-200 dark:border-slate-700 flex-shrink-0 overflow-y-auto transition-all duration-300 ease-in-out ${
          collapsed ? "p-3" : "p-6"
        }`}
      >
        {/* Header: Admin title + toggle button */}
        {collapsed ? (
          <div className="flex justify-center mb-6">
            <button
              onClick={() => setCollapsed(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
              title="展开侧边栏"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <Link href="/admin" className="text-lg font-black text-slate-900 dark:text-white font-[family-name:var(--font-geist-sans)]">
              Admin
            </Link>
            <button
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
              title="收起侧边栏"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        )}

        {/* Back to Site link (only when expanded) */}
        {!collapsed && (
          <Link href="/" className="text-xs text-slate-400 hover:text-indigo-500 transition-colors block mb-6 mt-1 border-b border-slate-200 dark:border-slate-700 pb-3">
            ← Back to Site
          </Link>
        )}

        {/* Navigation */}
        <nav className="flex flex-col gap-0.5 text-sm">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg transition-colors ${
                  collapsed
                    ? "flex items-center justify-center py-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white/50"
                    : `block px-3 py-2 ${
                        active
                          ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold"
                          : "text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white/50"
                      }`
                }`}
                onMouseEnter={(e) => {
                  if (!collapsed) return;
                  setHoveredTooltip({ text: item.tooltip, rect: e.currentTarget.getBoundingClientRect() });
                }}
                onMouseLeave={() => setHoveredTooltip(null)}
              >
                {collapsed ? (
                  <Icon size={18} className="flex-shrink-0" />
                ) : (
                  item.label
                )}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 p-8 flex flex-col min-h-0">{children}</main>

      {/* Collapsed sidebar tooltip (fixed to avoid overflow clipping) */}
      {hoveredTooltip && collapsed && (
        <div
          className="fixed z-[100] pointer-events-none glass-card !rounded-lg text-[11px] leading-relaxed font-medium px-3 py-1.5 text-slate-600 dark:text-slate-300"
          style={{
            left: hoveredTooltip.rect.right + 8,
            top: hoveredTooltip.rect.top + hoveredTooltip.rect.height / 2,
            transform: "translateY(-50%)",
          }}
        >
          {hoveredTooltip.text}
        </div>
      )}
    </div>
  );
}
