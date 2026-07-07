"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
// import { LogIn, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/lib/siteConfig";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import { useTheme } from "@/app/_components/layout/ThemeProvider";
import FullscreenToggle from "@/app/_components/common/FullscreenToggle";
import SettingsPanel from "@/app/_components/common/SettingsPanel";
import Tooltip from "@/app/_components/common/Tooltip";

const NAV_ITEMS = [
  { name: "Home", href: "/" },
  { name: "Articles", href: "/article" },
  { name: "Projects", href: "/project" },
  ...(siteConfig.featureLiterature ? [{ name: "Literature" as const, href: "/literature" as const }] : []),
  { name: "Gallery", href: "/gallery" },
  { name: "Timeline", href: "/timeline" },
  { name: "Chatter", href: "/chatter" },
  { name: "Friends", href: "/friends" },
  ...(siteConfig.featureGrowth ? [{ name: "Growth" as const, href: "/growth" as const }] : []),
  ...(siteConfig.featureAnalytics || siteConfig.featurePlatformData
    ? [{ name: "Analytics" as const, href: "/analytics" as const }]
    : []),
  { name: "About", href: "/about" },
];

export default function Navbar() {
  const [showNav, setShowNav] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const pathname = usePathname();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const [isStatic, setIsStatic] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setIsStatic(process.env.NEXT_PUBLIC_IS_STATIC === "true");
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setShowNav(false);
      } else {
        setShowNav(true);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <header
      className={`hidden md:block w-full fixed top-0 left-0 right-0 z-50 transition-all duration-500 border-b ${showNav ? "translate-y-0" : "-translate-y-full"
        } bg-white/40 dark:bg-slate-900/50 backdrop-blur-xl border-white/20 dark:border-white/5 shadow-sm`}
    >
      <div className="w-[90%] max-w-6xl mx-auto h-16 flex items-center px-4 sm:px-[30px] box-border">
        <Link
          href="/"
          className="text-xl font-black text-slate-800 dark:text-white tracking-tighter hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-300 shrink-0"
        >
          {(() => {
            const parts = siteConfig.navTitle.split("·");
            return parts.length > 1 ? <>
              {parts[0]}<span className="text-indigo-500 mx-1">·</span>{parts.slice(1).join("·")}
            </> : siteConfig.navTitle;
          })()}
        </Link>

        <nav className="flex gap-6 text-sm font-bold items-center ml-8 xl:ml-16 mr-auto">
          {NAV_ITEMS.map((link) => {
            const isActive = pathname === link.href || pathname === `${link.href}/`;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative py-1 transition-colors ${isActive
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-slate-700 dark:text-slate-200 hover:text-indigo-600"
                  }`}
              >
                {link.name}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-500 rounded-full animate-pulse" />
                )}
              </Link>
            );
          })}

          {/* Auth */}
          {siteConfig.featureAuth && !isStatic && (
            <Link
              href="/admin"
              className="text-xs text-indigo-500 hover:text-indigo-400 transition-colors ml-2 mr-2"
            >
              Admin
            </Link>
          )}
          {siteConfig.featureAuth && (
            isLoggedIn ? (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-slate-500">
                  {user?.nickname || user?.username || "User"}
                </span>
                <button
                  onClick={logout}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => router.push("/auth/login")}
                className="glass-btn !text-xs !py-1 !px-3 ml-2"
              >
                Sign In
              </button>
            )
          )}
        </nav>

        <div className="flex items-center gap-2 pl-4 pr-2 border-l border-slate-200 dark:border-slate-700 ml-4">
          <Tooltip text={isDark ? "日间模式" : "夜间模式"} position="bottom">
            <button onClick={toggleTheme}
              className="rounded-2xl backdrop-blur-md border shadow-lg p-2 flex items-center justify-center transition-all duration-500 hover:scale-[1.05] bg-white/40 dark:bg-slate-800/40 border-white/60 dark:border-slate-600/50 text-slate-500 dark:text-slate-300"
            >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isDark ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              )}
            </svg>
          </button>
          </Tooltip>
          <div className="relative">
            <Tooltip text="设置" position="bottom">
              <button onClick={() => setSettingsOpen(!settingsOpen)}
                className="rounded-2xl backdrop-blur-md border shadow-lg p-2 flex items-center justify-center transition-all duration-500 hover:scale-[1.05] bg-white/40 dark:bg-slate-800/40 border-white/60 dark:border-slate-600/50 text-slate-500 dark:text-slate-300"
              >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            </Tooltip>
            <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
          </div>
          <FullscreenToggle />
        </div>
      </div>
    </header>
  );
}
