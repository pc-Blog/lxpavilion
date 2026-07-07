"use client";

import { useState, useRef, useLayoutEffect, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import Tooltip from "@/app/_components/common/Tooltip";
import SubscribeForm from "@/app/_components/subscribe/SubscribeForm";
import HotTopicsSubscribeForm from "@/app/_components/subscribe/HotTopicsSubscribeForm";
import { siteConfig } from "@/lib/siteConfig";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  desc?: string;
}

interface Category {
  icon: string;
  label: string;
  items: NavItem[];
}

const CATEGORIES: Category[] = [
  {
    icon: "📁",
    label: "文件处理",
    items: [
      { icon: "🎨", label: "图片处理", desc: "图片转换/压缩/裁剪/旋转一体化工具", href: "/tools/image" },
      { icon: "🔒", label: "文件加密", desc: "文件加密解密工具，保护隐私安全", href: "/tools/file-encrypt" },
    ],
  },
  {
    icon: "🛠️",
    label: "开发工具",
    items: [
      { icon: "🔢", label: "进制转换", desc: "二进制/八进制/十进制/十六进制互相转换", href: "/tools/base-convert" },
      { icon: "📱", label: "二维码生成", desc: "文本/链接生成二维码，支持下载", href: "/tools/qrcode" },
      { icon: "📋", label: "JSON格式化", desc: "JSON 格式化/压缩/校验/树形查看", href: "/tools/json-formatter" },
      { icon: "🔑", label: "密码生成", desc: "随机密码生成器，自定义长度与字符集", href: "/tools/password" },
    ],
  },
  {
    icon: "🎮",
    label: "轻松一下",
    items: [
      { icon: "🧱", label: "俄罗斯方块", desc: "经典俄罗斯方块益智游戏", href: "/tools/tetris" },
      { icon: "🐍", label: "贪吃蛇", desc: "经典贪吃蛇小游戏", href: "/tools/snake" },
      { icon: "🔢", label: "2048", desc: "数字合并益智游戏，挑战最高分", href: "/tools/2048" },
      { icon: "💣", label: "扫雷", desc: "经典扫雷推理游戏", href: "/tools/minesweeper" },
      { icon: "⚫", label: "五子棋", desc: "人机对战五子棋，AI 自动评估", href: "/tools/gomoku" },
      { icon: "🧩", label: "图片拼图", desc: "上传图片分割成拼图碎片，挑战复原", href: "/tools/image-puzzle" },
      { icon: "🎯", label: "珠玑妙算", desc: "经典 Mastermind 破译密码游戏", href: "/tools/mastermind" },
      { icon: "🧮", label: "数独", desc: "经典数独推理游戏，9x9 数字填格", href: "/tools/sudoku" },
      { icon: "💡", label: "点灯游戏", desc: "经典 Lights Out 益智，熄灭所有灯", href: "/tools/lights-out" },
    ],
  },
  {
    icon: "🔖",
    label: "收藏夹",
    items: [
      { icon: "🎬", label: "Bibz Video", desc: "B站视频无水印下载，支持4K/1080P高清画质及弹幕导出", href: "https://bibz.me/video-extractor" },
      { icon: "⬇️", label: "Kdown", desc: "百度网盘高速下载解析服务，加速下载网盘文件", href: "https://kdown.moiu.cn/" },
      { icon: "🧰", label: "遐客", desc: "GitHub文件、Releases、归档代理加速下载", href: "https://xiake.pro/" },
      { icon: "📄", label: "CDKM", desc: "免费在线将Word、Excel等文档批量转换为PDF", href: "https://cdkm.com/cn/doc-to-pdf" },
      { icon: "📝", label: "MD转Word", desc: "免费在线Markdown转Word文档转换器", href: "https://markdowntoword.io/zh" },
      { icon: "📄", label: "老鱼简历", desc: "免费在线简历制作工具", href: "https://www.laoyujianli.com/" },
    ],
  },
  ...(siteConfig.featureComments ? [{
    icon: "💭",
    label: "心愿",
    items: [
      { icon: "💡", label: "功能建议", href: "/tools/wishes" },
    ],
  }] : []),
  ...(siteConfig.featureRssPush || siteConfig.featureHotTopics ? [{
    icon: "📬",
    label: "订阅",
    items: [
      { icon: "🔥", label: "热点技术", desc: "AI 每日精选 · 热点技术订阅", href: "#subscribe" },
    ],
  }] : []),
];

const submenuVariants: Variants = {
  hidden: { opacity: 0, x: 24, scale: 0.92 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 350, damping: 26 },
  },
  exit: {
    opacity: 0,
    x: 20,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

export default function FloatingNav() {
  const [active, setActive] = useState<number | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const [submenuOffset, setSubmenuOffset] = useState(0);

  useLayoutEffect(() => {
    if (active === null || !navRef.current) { setSubmenuOffset(0); return; }
    const btn = navRef.current.querySelector(`[data-nav-btn="${active}"]`) as HTMLElement | null;
    if (!btn) return;
    const navRect = navRef.current.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setSubmenuOffset(btnRect.top - navRect.top);
  }, [active]);

  // 子菜单打开时：Escape 关闭、点击外部关闭
  useEffect(() => {
    if (active === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    const onClickOutside = (e: MouseEvent) => {
      if (submenuRef.current && !submenuRef.current.contains(e.target as Node)) {
        setActive(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const timer = setTimeout(() => {
      document.addEventListener("click", onClickOutside);
    }, 0);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      clearTimeout(timer);
      document.removeEventListener("click", onClickOutside);
    };
  }, [active]);

  const itemCount = active !== null ? CATEGORIES[active].items.length : 0;
  const gridCols =
    itemCount === 1 ? "grid-cols-1" :
      itemCount === 2 ? "grid-cols-2" :
        "grid-cols-3";

  return (
    <div className="fixed right-4 top-1/2 z-50" style={{ transform: "translateY(-50%)" }}>
      <div className="relative flex items-start">
        {/* Submenu */}
        <AnimatePresence mode="wait">
          {active !== null && (
            <motion.div
              key={active}
              ref={submenuRef}
              variants={submenuVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute z-20 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xl rounded-2xl p-4 min-w-[300px] overflow-visible"
              style={{ right: "calc(100% + 0.75rem)", top: submenuOffset }}
              onMouseEnter={() => setActive(active)}
              onMouseLeave={() => {
                if (document.activeElement && submenuRef.current?.contains(document.activeElement)) return;
                setActive(null);
              }}
            >
              <div className="mb-3 pb-2 border-b border-slate-200/50 dark:border-white/5 text-xs font-bold text-slate-500 dark:text-slate-400 tracking-widest uppercase">
                {CATEGORIES[active].icon} {CATEGORIES[active].label}
              </div>
              {CATEGORIES[active].label === "订阅" ? (
                <div className="flex flex-col gap-4">
                  <SubscribeForm />
                  <HotTopicsSubscribeForm />
                </div>
              ) : (
                <motion.div
                  className={`grid ${gridCols} gap-2`}
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {CATEGORIES[active].items.map((item) => {
                    const isExternal = item.href.startsWith("http");
                    const Comp = isExternal ? "a" : Link;
                    const extraProps = isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {};
                    const card = (
                      <motion.div
                        whileHover={{ y: -4, scale: 1.05 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <Comp
                          href={item.href}
                          className="flex flex-col items-center justify-center aspect-square rounded-xl bg-white/50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-200 p-2"
                          {...extraProps}
                        >
                          <motion.span
                            className="text-2xl"
                            whileHover={{ rotate: [0, -10, 10, -5, 0] }}
                            transition={{ duration: 0.4 }}
                          >
                            {item.icon}
                          </motion.span>
                          <span className="text-[10px] font-medium mt-1 text-center leading-tight break-words max-w-full">
                            {item.label}
                          </span>
                        </Comp>
                      </motion.div>
                    );
                    return (
                      <motion.div key={item.href} variants={cardVariants}>
                        {item.desc ? (
                          <Tooltip text={item.desc} position="top">
                            {card}
                          </Tooltip>
                        ) : card}
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nav bar */}
        <div
          ref={navRef}
          className="flex flex-col gap-1 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-2xl rounded-2xl py-3 px-2 overflow-y-auto max-h-[85vh]"
          onMouseLeave={() => setActive(null)}
        >
          {CATEGORIES.map((cat, i) => {
            const isDirect = cat.items.length === 1 && cat.label !== "订阅";
            const btn = (
              <motion.button
                key={cat.label}
                data-nav-btn={i}
                onMouseEnter={() => !isDirect && setActive(i)}
                className={`flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-xl transition-colors duration-200 group ${active === i
                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                  }`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.92 }}
                animate={active === i ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={active === i ? { duration: 0.4, ease: "easeInOut" } : { duration: 0.2 }}
              >
                <motion.span
                  className="text-lg"
                  whileHover={{ rotate: [0, -8, 8, -4, 0] }}
                  transition={{ duration: 0.35 }}
                >
                  {cat.icon}
                </motion.span>
                <span className="text-[9px] font-bold tracking-widest">{cat.label}</span>
              </motion.button>
            );
            return isDirect ? (
              <Link
                key={cat.label}
                data-nav-btn={i}
                href={cat.items[0].href}
                className={`flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-xl transition-colors duration-200 group text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50`}
              >
                <span className="text-lg">{cat.icon}</span>
                <span className="text-[9px] font-bold tracking-widest">{cat.label}</span>
              </Link>
            ) : btn;
          })}
        </div>
      </div>
    </div>
  );
}