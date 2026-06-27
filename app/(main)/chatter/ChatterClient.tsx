"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import Lightbox, { type LightboxPhoto } from "@/app/_components/common/Lightbox";
import CommentSection from "@/app/_components/comment/CommentSection";
import { getPublishedList } from "@/lib/api/chatter";
import { get as getAbout } from "@/lib/api/about";
import { siteConfig, loadConfig } from "@/lib/config";
import { assetUrl } from "@/lib/asset-url";

interface Moment {
  id: string;
  content: string;
  images: string[];
  mood: string;
  createTime: string;
}

interface Photo {
  id: string;
  url: string;
  caption: string;
  orientation: "landscape" | "portrait";
}

const rotations = [-2, 1.5, -1, 2, -1.5, 1, -0.5, 1.5];

const MOOD_EMOJI: Record<string, string> = {
  "happy": "😊", "joy": "😄", "excited": "🤩", "moved": "😭",
  "sad": "😢", "grief": "😞", "hurt": "😥",
  "angry": "😠", "fury": "💢",
  "tired": "😩", "exhausted": "😮‍💨", "sleepy": "😴",
  "calm": "😌", "daze": "😶", "thinking": "🤔",
  "cheer": "💪", "strive": "🔥",
  "morning": "☀️", "night": "🌙", "good": "👍",
  "like": "💖", "love": "❤️", "nice": "👍",
  /* 中文别名 */
  "开心": "😊", "快乐": "😄", "高兴": "🎉", "愉悦": "😆",
  "难过": "😢", "悲伤": "😭", "伤心": "😥", "哀愁": "🥺",
  "疲惫": "😩", "累": "😮‍💨", "困": "😴", "无力": "😑",
  "兴奋": "🤩", "激动": "🎊", "期待": "🥰", "渴望": "🥺",
  "平静": "😌", "安宁": "🕊️", "放松": "🧘", "惬意": "☺️",
  "烦躁": "😠", "愤怒": "💢", "恼火": "😤", "不耐烦": "🙄",
  "迷茫": "😶", "困惑": "😕", "不解": "🤨", "无措": "😧",
  "想念": "🥹", "怀念": "🥲", "思恋": "💗", "回忆": "📸",
  "随想": "🤔", "灵感": "💡", "思考": "🧠", "冥想": "🧘",
  "惊喜": "😲", "惊讶": "😱", "震惊": "🤯",
  "感恩": "🙏", "感动": "😭", "温暖": "☀️", "治愈": "🫂",
  "孤独": "💔", "寂寞": "🌧️", "失落": "😞", "沮丧": "😔",
  "焦虑": "😰", "紧张": "😬", "担心": "😟", "不安": "😨",
  "自豪": "🥹", "满足": "😊", "自信": "💪", "坚定": "✊",
  "无聊": "🥱", "懒散": "🦥", "发呆": "😶",
  "生病": "🤒", "难受": "😷", "痛苦": "😖", "晕": "😵",
  "美好": "✨", "浪漫": "🌹", "甜蜜": "🍯", "幸福": "💕",
  "酸": "🍋", "嫉妒": "😒", "苦涩": "🧋",
  "辣": "🌶️", "刺激": "🎢", "冒险": "🧗",
  "冷": "🥶", "热": "🥵", "饿": "🍽️", "饱": "😋",
  "赞": "👍", "棒": "👏", "优秀": "🏆", "绝了": "🔥",
};

function moodEmoji(mood: string): string {
  return MOOD_EMOJI[mood] || "💬";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 3) return `${days}d ago`;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function ChatterFallback() {
  return (
    <div className="w-2/5 mx-auto px-4 sm:px-6 py-6 md:py-12">
      <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
        <MessageSquare className="w-5 h-5 md:w-7 md:h-7 text-sky-500" />
        <h1 className="text-xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">
          Chatter
        </h1>
      </div>
      <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 ml-7 md:ml-10">
        Fragments of code, academia, and life.
      </p>
      <div className="space-y-3 md:space-y-6 mt-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 md:h-24 rounded-2xl bg-white/40 dark:bg-slate-800/40 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function ChatterContent() {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [, forceUpdate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const [onlyViewId, setOnlyViewId] = useState<string | null>(() => searchParams.get("onlyView"));
  const [lightbox, setLightbox] = useState<{
    photos: Photo[];
    index: number;
  } | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await getPublishedList();
        getAbout().then(about => { loadConfig(about); forceUpdate(n => n + 1); }).catch(() => {});
        if (!active) return;
        setMoments(data.map((item) => ({
          id: String(item.id),
          content: item.content,
          images: Array.isArray(item.images) ? item.images : [],
          mood: item.mood || "",
          createTime: item.createTime || "",
        })));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const dayGroups = useMemo(() => {
    const map = new Map<string, Moment[]>();
    for (const m of moments) {
      const key = m.createTime.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries())
      .map(([key, items]) => ({ date: key, label: formatDate(items[0].createTime), moments: items.sort((a, b) => a.createTime.localeCompare(b.createTime)) }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [moments]);

  const visibleGroups = onlyViewId
    ? dayGroups.map((g) => ({ ...g, moments: g.moments.filter((m) => m.id === onlyViewId) })).filter((g) => g.moments.length > 0)
    : dayGroups;

  if (loading) {
    return (
      <div className="w-2/5 mx-auto px-4 sm:px-6 py-6 md:py-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-6 md:mb-12">
          <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
            <MessageSquare className="w-5 h-5 md:w-7 md:h-7 text-sky-500" />
            <h1 className="text-xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">
              Chatter
            </h1>
          </div>
          <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 ml-7 md:ml-10">
            Fragments of code, academia, and life.
          </p>
        </motion.div>
        <div className="space-y-3 md:space-y-6">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 md:h-24 rounded-2xl bg-white/40 dark:bg-slate-800/40 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="w-2/5 mx-auto px-4 sm:px-6 py-6 md:py-12">
      {/* 页头 */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-6 md:mb-12">
        <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
          <MessageSquare className="w-5 h-5 md:w-7 md:h-7 text-sky-500" />
          <div className="text-xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">
            Chatter
          </div>
        </div>
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 ml-7 md:ml-10">
          Fragments of code, academia, and life.
        </p>
      </motion.div>

      {onlyViewId && (
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} type="button" onClick={() => setOnlyViewId(null)}
          className="flex items-center gap-1.5 text-xs md:text-sm text-slate-500 hover:text-sky-500 transition-colors mb-4 md:mb-8">
          <ChevronLeft className="w-3.5 h-3.5 md:w-4 md:h-4" />Back to all
        </motion.button>
      )}

      {!loading && moments.length === 0 && (
        <div className="text-center py-12 md:py-20 text-slate-400">
          <MessageSquare className="w-8 h-8 md:w-12 md:h-12 mx-auto mb-3 md:mb-4 opacity-40" />
          <p className="text-sm md:text-base">No chatter yet</p>
        </div>
      )}

      {visibleGroups.map((group, groupIdx) => (
        <motion.div key={group.date} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: groupIdx * 0.1 }} className="mb-8 md:mb-14 last:mb-0">
          <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-5">
            <span className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-300">{group.label}</span>
            <span className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400">{group.moments.length} posts</span>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-200 dark:from-slate-700 to-transparent" />
          </div>

          <div className="relative" style={{ minHeight: group.moments.length > 1 ? 100 + (group.moments.length - 1) * 18 : "auto" }}>
            {group.moments.map((moment, i) => {
              const rot = rotations[i % rotations.length];
              const offsetX = i % 2 === 0 ? -4 : 4;
              const isExpanded = expandedId === moment.id;
              const hasImages = moment.images && moment.images.length > 0;

              return (
                <motion.div key={moment.id} layout
                  ref={(el) => { if (isExpanded && el) el.scrollIntoView({ block: "nearest" }); }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0, rotate: isExpanded ? 0 : onlyViewId ? 0 : rot, x: isExpanded ? 0 : onlyViewId ? 0 : offsetX }}
                  transition={{
                    ease: [0.25, 0.46, 0.45, 0.94], duration: 0.35, delay: i * 0.05,
                    layout: { type: "tween", ease: [0.25, 0.46, 0.45, 0.94], duration: 0.35 },
                  }}
                  whileHover={!isExpanded && !onlyViewId ? { rotate: 0, x: 0, y: -4, scale: 1.01 } : undefined}
                  onClick={() => setExpandedId(isExpanded ? null : moment.id)}
                  className={`${group.moments.length > 1 && !onlyViewId ? "absolute left-0 right-0" : "relative"} cursor-pointer`}
                  style={{ zIndex: isExpanded ? 50 : group.moments.length - i, ...(group.moments.length > 1 && !onlyViewId ? { top: i * 18 } : {}) }}>
                  <div className="rounded-2xl bg-white/50 dark:bg-slate-800/60 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg overflow-hidden transition-shadow duration-300 hover:shadow-xl">
                    {!isExpanded && !onlyViewId && (
                      <div className="px-3 py-3 md:px-5 md:py-4">
                        <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                          <span className="text-[10px] md:text-xs text-slate-400">{relativeTime(moment.createTime)}</span>
                          {moment.mood && <span className="text-[10px] md:text-xs">{moodEmoji(moment.mood)} {moment.mood}</span>}
                          {hasImages && <span className="text-[10px] md:text-xs text-slate-400">📷</span>}
                        </div>
                        <p className="text-xs md:text-sm text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">{moment.content}</p>
                      </div>
                    )}

                    {(isExpanded || onlyViewId) && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                        <div className="p-3 md:p-5">
                          <div className="flex items-center justify-between mb-2 md:mb-3">
                            <div className="flex items-center gap-2 md:gap-2.5">
                              <div className="relative shrink-0">
                                <div className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-sky-400 via-indigo-400 to-purple-400 opacity-60 blur-[2px]" />
                                <img
                                  src={assetUrl(siteConfig.avatarUrl)}
                                  alt={siteConfig.authorName}
                                  className="relative w-7 h-7 md:w-8 md:h-8 rounded-full object-cover border-2 border-white dark:border-slate-800"
                                />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs md:text-sm font-semibold text-slate-800 dark:text-slate-200 leading-tight">{siteConfig.authorName}</span>
                                <span className="text-[10px] md:text-xs text-slate-400 leading-tight">{relativeTime(moment.createTime)}</span>
                              </div>
                            </div>
                            {moment.mood && (
                              <span className="text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium">{moodEmoji(moment.mood)} {moment.mood}</span>
                            )}
                          </div>

                          {isExpanded && group.moments.length > 1 && (
                            <div className="flex items-center justify-center gap-3 md:gap-4 mb-3 md:mb-4">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setExpandedId(group.moments[i - 1].id); }}
                                disabled={i === 0}
                                className="p-1 rounded-full text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-500/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                              >
                                <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                              </button>
                              <span className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                                {i + 1} / {group.moments.length}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setExpandedId(group.moments[i + 1].id); }}
                                disabled={i === group.moments.length - 1}
                                className="p-1 rounded-full text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-500/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                              >
                                <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                              </button>
                            </div>
                          )}

                          <p className="text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3 md:mb-4 whitespace-pre-wrap">{moment.content}</p>

                          {hasImages && (
                            <div className={`grid gap-1.5 md:gap-2 mb-3 md:mb-4 ${moment.images.length <= 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                              {moment.images.map((img, idx) => {
                                const photos: Photo[] = moment.images.map((url, pi) => ({ id: `${moment.id}-${pi}`, url: assetUrl(url), caption: "", orientation: "landscape" as const }));
	                                return (
	                                  <div key={idx} onClick={(e) => { e.stopPropagation(); setLightbox({ photos, index: idx }); }}
	                                    className="relative rounded-lg md:rounded-xl overflow-hidden cursor-pointer group/img aspect-square">
	                                    <img src={assetUrl(img)} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105" />
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <div className="flex items-center justify-end pt-2 md:pt-3 border-t border-slate-200/50 dark:border-white/5">
                            <button type="button" onClick={(e) => { e.stopPropagation(); setOnlyViewId(onlyViewId === moment.id ? null : moment.id); }}
                              className="text-[10px] md:text-xs px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-colors">
                              {onlyViewId === moment.id ? "Back to all" : "View only"}
                            </button>
                          </div>

                          {(isExpanded/* onlyView 下评论区由父容器切换控制 */) && (
                            <div className="mt-4 pt-4 border-t border-slate-200/40 dark:border-white/5">
                              <CommentSection path={`chatter-${moment.id}`} />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      ))}

      <AnimatePresence>
        {expandedId && !onlyViewId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setExpandedId(null)} className="fixed inset-0 bg-black/20 z-40" />
        )}
      </AnimatePresence>

      <Lightbox photos={lightbox?.photos ?? []} index={lightbox?.index ?? 0} open={!!lightbox}
        onClose={() => setLightbox(null)}
        onPrev={() => setLightbox((lb) => lb ? { ...lb, index: (lb.index - 1 + lb.photos.length) % lb.photos.length } : null)}
        onNext={() => setLightbox((lb) => lb ? { ...lb, index: (lb.index + 1) % lb.photos.length } : null)} />
    </div>
  );
}

export default function ChatterClient() {
  return (
    <Suspense fallback={<ChatterFallback />}>
      <ChatterContent />
    </Suspense>
  );
}