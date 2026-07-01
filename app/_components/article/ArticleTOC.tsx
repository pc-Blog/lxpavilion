"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

function extractTOC(content: string): TOCItem[] {
  const items: TOCItem[] = [];
  const idCount = new Map<string, number>();
  const headingRegex = /^(#{1,3})\s+(.+)$/;
  const fenceRegex = /^(```|~~~)/;
  let inCodeBlock = false;

  for (const line of content.split("\n")) {
    if (fenceRegex.test(line.trim())) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = headingRegex.exec(line);
    if (!match) continue;

    const text = match[2].trim().replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
    let id = text.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").replace(/(^-|-$)/g, "");
    const count = idCount.get(id) || 0;
    idCount.set(id, count + 1);
    if (count > 0) id = `${id}-${count}`;
    items.push({ id, text, level: match[1].length });
  }
  return items;
}

function easeInOutCubic(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

export default function ArticleTOC({ content }: { content: string }) {
  const items = useMemo(() => extractTOC(content), [content]);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    if (items.length === 0) return;
    const articleEl = document.getElementById("article-content");
    if (!articleEl) return;

    const headings = articleEl.querySelectorAll("h1, h2, h3");
    const headingIdCount = new Map<string, number>();
    headings.forEach((h) => {
      let id = h.textContent?.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").replace(/(^-|-$)/g, "") || "";
      const count = headingIdCount.get(id) || 0;
      headingIdCount.set(id, count + 1);
      if (count > 0) id = `${id}-${count}`;
      h.id = id;
    });

    const onScroll = () => {
      for (let i = items.length - 1; i >= 0; i--) {
        const el = document.getElementById(items[i].id);
        if (el && el.getBoundingClientRect().top <= 120) {
          setActiveId(items[i].id);
          return;
        }
      }
      if (items.length > 0) setActiveId(items[0].id);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [items]);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const start = window.scrollY;
    const end = el.getBoundingClientRect().top + window.scrollY - 100;
    const duration = 600;
    let startTime: number | null = null;
    const animate = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      window.scrollTo(0, start + (end - start) * easeInOutCubic(progress));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, []);

  if (items.length === 0) return null;

  return (
    <nav className="glass-card p-5 text-sm sticky top-28 max-h-[75vh] overflow-y-auto relative">
      <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4 pl-4 border-l-4 border-indigo-500">
        Contents
      </h4>

      <div className="absolute left-5 top-12 bottom-3 w-[2px] bg-slate-200 dark:bg-slate-700" />

      <ul className="space-y-0.5 relative">
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li key={item.id} style={{ paddingLeft: `${(item.level - 1) * 12}px` }}>
              <a
                href={`#${item.id}`}
                onClick={(e) => { e.preventDefault(); scrollTo(item.id); }}
                className={`relative flex items-center gap-2 py-1.5 text-xs transition-all duration-200 hover:text-indigo-500 ${
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400 font-bold scale-[1.02]"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {isActive && (
                  <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-[6px] h-[6px] rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" style={{ left: `-${14 + (item.level - 1) * 12}px` }} />
                )}
                <span className="truncate">{item.text}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
