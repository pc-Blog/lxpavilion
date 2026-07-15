"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/stores/authStore";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import type { Components } from "react-markdown";
import { siteConfig } from "@/lib/siteConfig";
import Tooltip from "@/app/_components/common/Tooltip";

const mdComponents: Components = {
  h1: ({ children }) => <h1 className="text-lg font-black mb-1 mt-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-black mb-1 mt-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-black mb-1 mt-2">{children}</h3>,
  p: ({ children }) => <p className="my-0.5">{children}</p>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ className, children, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return <code className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-1 py-0.5 rounded text-xs">{children}</code>;
    }
    return <pre className="bg-[#282c34] rounded-lg p-3 my-1 overflow-x-auto text-xs"><code className={className} {...props}>{children}</code></pre>;
  },
  pre: ({ children }) => <>{children}</>,
  ul: ({ children }) => <ul className="list-disc pl-5 my-1 text-sm">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-1 text-sm">{children}</ol>,
  li: ({ children }) => <li className="my-0.5">{children}</li>,
  blockquote: ({ children }) => <blockquote className="border-l-3 border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10 pl-3 py-1 my-1 rounded-r-lg text-sm italic text-slate-600 dark:text-slate-400">{children}</blockquote>,
  a: ({ href, children }) => <a href={href} className="text-indigo-500 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
  del: ({ children }) => <del className="line-through">{children}</del>,
  hr: () => <hr className="my-2 border-slate-200 dark:border-slate-700" />,
};

/* ── 常量 ── */

const WORKER_API = `https://${siteConfig.workerApi}/api`;

const EMOJIS = [
  // 表情
  "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😌", "😍", "🥰", "😘",
  "😗", "😋", "😛", "🤗", "🤩", "🤔", "🤨", "😐", "😑", "😶", "🙄", "😏", "😣", "😥", "😮",
  "🤐", "😯", "😪", "😫", "😴", "😤", "😡", "🤬", "😢", "😭", "😰", "😱", "🥵", "🥶", "🤢",
  "🤮", "🥴", "😵", "🤯", "🤠", "🥳", "🥺", "😈", "👿", "👻", "💀", "☠️", "👽", "🤖", "🎃",
  // 爱心
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💕", "💞", "💗", "💖", "💘", "💝", "💔",
  // 手势
  "👍", "👎", "👊", "✊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✌️", "🤟", "🤘",
  "👌", "✋", "💪", "🖕", "🤏", "🫶", "🫰", "👋", "🖐️", "✍️", "👈", "👉", "👆", "👇",
  // 动物
  "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵",
  "🐔", "🐧", "🐦", "🐤", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋",
  "🐌", "🐞", "🐜", "🦗", "🪲", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙", "🦑", "🦐", "🦞", "🦀",
  "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🦧", "🐘", "🐪",
  "🐫", "🦒", "🦘", "🦬", "🐃", "🐂", "🐄", "🐎", "🐖", "🐏", "🐑", "🦙", "🦌", "🐕", "🐩",
  "🦮", "🐕‍🦺", "🐈", "🐈‍⬛", "🪶", "🐓", "🦃", "🦤", "🦚", "🦜", "🦢", "🦩", "🕊️", "🐇", "🦝",
  // 自然
  "🌹", "🌸", "🌺", "🌻", "🌷", "🌿", "🍀", "🌵", "🎄", "🌲", "🌳", "🌴", "🪴", "🌾", "🍁",
  "🍂", "🍃", "🌍", "🌎", "🌏", "🌕", "🌙", "⭐", "✨", "🌟", "💫", "☀️", "🌈", "⛅", "❄️",
  "🔥", "💥", "🌊", "💧", "✨", "💨", "🌪️", "🌈", "☁️", "☔", "⚡", "🌩️", "🌨️", "🌧️", "🌦️",
  // 食物
  "🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥝", "🍅",
  "🥑", "🥦", "🥬", "🥒", "🌽", "🥕", "🧄", "🧅", "🥔", "🍠", "🥐", "🍞", "🥖", "🧀", "🥚",
  "🍳", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🦴", "🌭", "🍔", "🍟", "🍕", "🥪", "🥙", "🧆",
  "🌮", "🌯", "🥗", "🥘", "🫕", "🥫", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🦪", "🍤",
  "🍙", "🍚", "🍘", "🍥", "🥠", "🥮", "🍢", "🍡", "🍧", "🍨", "🍦", "🥧", "🧁", "🍰", "🎂",
  "🍫", "🍬", "🍭", "🍮", "🍯", "🍼", "🥛", "☕", "🍵", "🧃", "🥤", "🧋", "🍶", "🍺", "🍻",
  "🥂", "🍷", "🥃", "🍸", "🍹", "🧉", "🍾",
  // 运动
  "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "🏑",
  "🥍", "🏏", "🪃", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "⛸️",
  "🎿", "⛷️", "🏂", "🏋️", "🤼", "🤸", "🤺", "⛹️", "🤾", "🏌️", "🏄", "🏊", "🤽", "🚣", "🧗",
  // 物品
  "💻", "📱", "📀", "💿", "📷", "📸", "📹", "🎥", "📽️", "📞", "☎️", "📟", "📠", "🔋", "💡",
  "🔦", "🕯️", "📚", "📖", "📝", "✏️", "🖊️", "🖍️", "📌", "📍", "✂️", "🔗", "🧩", "🎯", "🏆",
  "🥇", "🥈", "🥉", "🎵", "🎶", "🎤", "🎧", "🎸", "🎹", "🎺", "🎻", "🥁", "🎬", "🎨", "🎭",
  // 符号
  "✅", "❌", "❓", "❗", "❗", "⚠️", "🚫", "🔞", "💯", "🔅", "🔆", "🔱", "〽️", "♻️", "🏧",
  "🚮", "🚰", "♿", "🚹", "🚺", "🚻", "🚼", "🚾", "🛂", "🛃", "🛄", "🛅", "⚠️", "🚸", "⛔",
  // 交通
  "🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🏍️",
  "🛵", "🛺", "🚲", "🛴", "🚨", "🚔", "🚍", "🚘", "🚖", "🛞", "✈️", "🚀", "🛸", "🚁", "🛰️",
  "🚂", "🚆", "🚇", "🚊", "🚉", "🚝", "🚄", "🚅", "🚈", "🚞", "🚃", "🚋", "🚎", "🚐", "🚍",
  "⛵", "🛳️", "⛴️", "🛥️", "🚤", "🛶", "⚓", "🪝", "⛽", "🚏", "🚦", "🚥", "🗺️", "🗿", "🏠",
];

const REACTION_EMOJI: Record<string, string> = {
  THUMBS_UP: "👍", THUMBS_DOWN: "👎", LAUGH: "😄", HOORAY: "🎉",
  CONFUSED: "😕", HEART: "❤️", ROCKET: "🚀", EYES: "👀",
};

const REACTION_LIST = [
  "THUMBS_UP", "THUMBS_DOWN", "LAUGH", "HOORAY",
  "CONFUSED", "HEART", "ROCKET", "EYES",
] as const;

/* ── 类型 ── */

interface Author {
  id: number; nickname: string; avatar: string;
}

interface Reaction {
  reaction: string; count: number; viewerHasReacted: boolean;
}

interface CommentData {
  nodeId: string; content: string; author: Author;
  createdAt: string; lastEditedAt: string | null; deletedAt: string | null;
  replyToId: string | null;
  reactions: Reaction[]; upvoteCount: number; viewerHasUpvoted: boolean;
  replies: CommentData[];
}

interface ListResponse {
  discussionId: string | null; locked: boolean;
  comments: CommentData[]; discussionReactions: Reaction[];
}

/* ── API ── */

/** 从 localStorage 检查当前游客是否拥有某条评论 */
function isGuestOwner(nodeId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const ids: string[] = JSON.parse(localStorage.getItem("guestCommentIds") || "[]");
    return ids.includes(nodeId);
  } catch { return false; }
}

function genId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("token");
  const guestSession = localStorage.getItem("guestSession");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else if (guestSession) {
    headers["X-Guest-Session"] = guestSession;
  }
  const res = await fetch(`${WORKER_API}${path}`, { headers, ...options });
  const json = await res.json();
  if (json.code !== 1) throw new Error(json.msg || "请求失败");
  return json.data as T;
}

/* ── 时间 ── */

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const day = Math.floor(h / 24);
  if (day < 30) return `${day} 天前`;
  return d.toLocaleDateString("zh-CN");
}

/* ════════════════════════════════════
   组件
   ════════════════════════════════════ */

function Avatar({ src, name, size = 30 }: { src?: string; name: string; size?: number }) {
  const initial = (name || "?")[0].toUpperCase();
  const px = `${size}px`;
  if (src) {
    return (
      <img src={src} alt={name} className="rounded-full object-cover flex-shrink-0" style={{ width: px, height: px }} />
    );
  }
  return (
    <div className="rounded-full bg-gradient-to-tr from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ width: px, height: px }}>
      {initial}
    </div>
  );
}

/* ── 编辑器 ── */

function Editor({
  initialValue = "", placeholder = "写下你的评论...", submitLabel = "发表",
  onSubmit, onCancel, loading,
}: {
  initialValue?: string; placeholder?: string; submitLabel?: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void; loading?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isBusy = loading || false;

  useEffect(() => { if (initialValue) autoResize(); }, []);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 320) + "px";
  }, []);

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newVal = value.slice(0, start) + emoji + value.slice(end);
    setValue(newVal);
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus();
      autoResize();
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || isBusy) return;
    await onSubmit(value.trim());
    if (!initialValue) setValue("");
  };
  return (
    <form onSubmit={handleSubmit}>
      {/* Tab 栏 */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-700 mb-3">
        <button type="button" onClick={() => setTab("write")}
          className={`px-3 py-1.5 text-xs font-bold transition-colors border-b-2 -mb-[1px] ${
            tab === "write"
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          }`}>写</button>
        <button type="button" onClick={() => setTab("preview")}
          className={`px-3 py-1.5 text-xs font-bold transition-colors border-b-2 -mb-[1px] ${
            tab === "preview"
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          }`}>预览</button>
      </div>

      {tab === "write" ? (
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => { setValue(e.target.value); autoResize(); }}
            onInput={autoResize}
            placeholder={placeholder}
            className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 resize-none outline-none overflow-y-auto min-h-[80px]"
            disabled={isBusy}
          />
          <Tooltip text="表情">
            <button type="button" onClick={() => setShowEmoji(!showEmoji)}
              className="absolute right-1 bottom-12 w-6 h-6 flex items-center justify-center text-sm rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">😊</button>
          </Tooltip>
          {showEmoji && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowEmoji(false)} />
              <div className="absolute right-1 bottom-full mb-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 max-h-[200px] overflow-y-auto" style={{ width: "280px" }}>
                <div className="flex flex-wrap gap-1">
                  {EMOJIS.map((emoji, i) => (
                    <button key={i} type="button" onClick={() => { insertEmoji(emoji); setShowEmoji(false); }}
                      className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                    >{emoji}</button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="min-h-[80px] max-h-[320px] overflow-y-auto text-sm text-slate-600 dark:text-slate-300 break-words border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white/50 dark:bg-slate-800/30">
          {value.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={mdComponents}>{value}</ReactMarkdown>
          ) : (
            <p className="italic text-slate-400">无内容可预览</p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-3">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="px-4 py-1.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors">
            取消
          </button>
        )}
        <button type="submit" disabled={!value.trim() || isBusy}
          className="px-5 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-40">
          {loading ? "提交中..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

/* ── 反应按钮 ── */

function ReactionBar({
  subjectId, reactions, onToggle, disabled,
}: {
  subjectId: string; reactions: Reaction[];
  onToggle: (id: string, r: string) => Promise<void>;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const active = reactions.filter((r) => r.count > 0);

  return (
    <div className="inline-flex items-center gap-1 flex-wrap">
      {active.map((r) => (
        <button key={r.reaction} disabled={disabled}
          onClick={() => onToggle(subjectId, r.reaction)}
          className={`inline-flex items-center gap-0.5 text-sm px-1.5 py-0.5 rounded-full border transition-all disabled:opacity-50 ${
            r.viewerHasReacted
              ? "bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700"
              : "border-transparent hover:border-slate-300 dark:hover:border-slate-600"
          }`}
        >
          {REACTION_EMOJI[r.reaction]} <span className="text-xs text-slate-500 dark:text-slate-400">{r.count}</span>
        </button>
      ))}
      <div className="relative">
        <Tooltip text="添加反应">
            <button disabled={disabled} onClick={() => setOpen(!open)}
            className="text-sm px-1.5 py-0.5 rounded-full border border-transparent hover:border-slate-300 dark:hover:border-slate-600 transition-all disabled:opacity-50">😊</button>
          </Tooltip>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 bottom-full mb-2 z-50 glass-card !rounded-xl p-2 shadow-xl flex gap-1 min-w-[200px]">
              {REACTION_LIST.map((name) => {
                const r = reactions.find((rr) => rr.reaction === name);
                const active = r?.viewerHasReacted || false;
                return (
                  <button key={name} onClick={() => { onToggle(subjectId, name); setOpen(false); }}
                    className={`p-1.5 rounded-lg text-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${active ? "bg-indigo-50 dark:bg-indigo-900/30" : ""}`}
                    >{REACTION_EMOJI[name]}</button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── 点赞按钮 ── */

function UpvoteBtn({ count, active, disabled, onClick }: {
  count: number; active: boolean; disabled: boolean; onClick: () => void;
}) {
  return (
    <button disabled={disabled} onClick={onClick}
      className={`inline-flex items-center gap-1 text-sm px-2 py-0.5 rounded-full border transition-all disabled:opacity-50 ${
        active
          ? "bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400"
          : "border-transparent hover:border-slate-300 dark:hover:border-slate-600 text-slate-500 dark:text-slate-400"
      }`}>
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><path d="M3.47 7.78a.75.75 0 0 1 0-1.06l4.152-4.152a.75.75 0 0 1 1.06 0l4.152 4.152a.75.75 0 0 1-1.06 1.06L9 4.81v8.44a.75.75 0 0 1-1.5 0V4.81L4.53 7.78a.75.75 0 0 1-1.06 0Z"/></svg>
      {count > 0 && <span>{count}</span>}
    </button>
  );
}

/* ════════════════════════════════════
   回复项
   ════════════════════════════════════ */

function ReplyItem({ reply, onReaction, onUpvote, onEdit, onDelete }: {
  reply: CommentData;
  onReaction: (id: string, r: string) => Promise<void>;
  onUpvote: (id: string) => Promise<void>;
  onEdit: (id: string, c: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { user } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  if (reply.deletedAt) return <p className="text-xs text-slate-400 italic py-2">该回复已被删除</p>;

  return (
    <div className="py-2">
      <div className="flex items-center gap-2">
        <Avatar src={reply.author.avatar} name={reply.author.nickname} size={24} />
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{reply.author.nickname}</span>
        <span className="text-[10px] text-slate-400">{formatTime(reply.createdAt)}</span>
        {reply.lastEditedAt && <span className="text-[10px] text-slate-400 italic">已编辑</span>}
      </div>

      {editing ? (
        <div className="mt-2">
          <Editor initialValue={reply.content} placeholder="编辑回复..." submitLabel="保存"
            onSubmit={async (c) => { setBusy(true); try { await onEdit(reply.nodeId, c); setEditing(false); } finally { setBusy(false); } }}
            onCancel={() => setEditing(false)} loading={busy} />
        </div>
      ) : (
        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300 break-words">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={mdComponents}>{reply.content}</ReactMarkdown>
        </div>
      )}

      {!editing && (
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          <UpvoteBtn count={reply.upvoteCount} active={reply.viewerHasUpvoted} disabled={!user} onClick={() => onUpvote(reply.nodeId)} />
          <ReactionBar subjectId={reply.nodeId} reactions={reply.reactions} onToggle={onReaction} disabled={!user} />
          {Date.now() - new Date(reply.createdAt).getTime() < 3600000 && (user?.id === reply.author.id || (reply.author.id === 0 && user?.nickname === reply.author.nickname) || (!user && isGuestOwner(reply.nodeId))) && (
            <div className="flex gap-1 ml-auto">
              <button onClick={() => setEditing(true)} className="text-[11px] text-slate-400 hover:text-indigo-500 px-1.5 py-0.5">编辑</button>
              {confirmDelete ? (
                <>
                  <button onClick={() => { onDelete(reply.nodeId); setConfirmDelete(false); }} className="text-[11px] text-red-500 px-1.5 py-0.5">确认删除</button>
                  <button onClick={() => setConfirmDelete(false)} className="text-[11px] text-slate-400 px-1.5 py-0.5">取消</button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="text-[11px] text-slate-400 hover:text-red-500 px-1.5 py-0.5">删除</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════
   评论卡片
   ════════════════════════════════════ */

function CommentCard({ comment, onReply, onEdit, onDelete, onReaction, onUpvote }: {
  comment: CommentData;
  onReply: (parentId: string, c: string) => Promise<void>;
  onEdit: (id: string, c: string) => Promise<void>;
  onDelete: (id: string, replyIds?: string[]) => Promise<void>;
  onReaction: (id: string, r: string) => Promise<void>;
  onUpvote: (id: string) => Promise<void>;
}) {
  const { user } = useAuthStore();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [replyCount, setReplyCount] = useState(2);
  const [expanded, setExpanded] = useState(false);
  const isLong = comment.content.length > 400;

  if (comment.deletedAt) return (
    <div className="glass-card !rounded-2xl p-4"><p className="text-sm text-slate-400 italic">该评论已被删除</p></div>
  );

  return (
    <div className="glass-card !rounded-2xl p-4 hover:shadow-[0_0_30px_rgba(99,102,241,0.35),0_0_60px_rgba(99,102,241,0.15)] dark:hover:shadow-[0_0_30px_rgba(129,140,248,0.3),0_0_60px_rgba(129,140,248,0.12)]">
      {/* 头部 */}
      <div className="flex items-center gap-3">
        <Avatar src={comment.author.avatar} name={comment.author.nickname} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{comment.author.nickname}</p>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>{formatTime(comment.createdAt)}</span>
            {comment.lastEditedAt && <span className="italic">已编辑</span>}
          </div>
        </div>
      </div>

      {/* 正文 */}
      {editing ? (
        <div className="mt-3">
          <Editor initialValue={comment.content} placeholder="编辑评论..." submitLabel="保存"
            onSubmit={async (c) => { setBusy(true); try { await onEdit(comment.nodeId, c); setEditing(false); } finally { setBusy(false); } }}
            onCancel={() => setEditing(false)} loading={busy} />
        </div>
      ) : (
        <div className={`mt-3 text-sm text-slate-600 dark:text-slate-300 break-words relative ${isLong && !expanded ? "max-h-[120px] overflow-hidden" : ""}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={mdComponents}>{comment.content}</ReactMarkdown>
          {isLong && !expanded && (
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-slate-800 to-transparent pointer-events-none" />
          )}
        </div>
      )}
      {isLong && (
        <button onClick={() => setExpanded(!expanded)}
          className="text-xs text-indigo-500 hover:text-indigo-600 mt-1 mb-2">
          {expanded ? "收起" : "展开全部"}
        </button>
      )}
      {!editing && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <UpvoteBtn count={comment.upvoteCount} active={comment.viewerHasUpvoted} disabled={!user} onClick={() => onUpvote(comment.nodeId)} />
          <ReactionBar subjectId={comment.nodeId} reactions={comment.reactions} onToggle={onReaction} disabled={!user} />

          <div className="flex gap-1 ml-auto">
            {(user || isGuestOwner(comment.nodeId)) && (
              <button onClick={() => { setShowReplyForm(!showReplyForm); setEditing(false); }}
                className="text-xs text-slate-400 hover:text-indigo-500 transition-colors px-2 py-1">回复</button>
            )}
            {Date.now() - new Date(comment.createdAt).getTime() < 3600000 && (user?.id === comment.author.id || (comment.author.id === 0 && user?.nickname === comment.author.nickname) || (!user && isGuestOwner(comment.nodeId))) && (
              <>
                <button onClick={() => { setEditing(true); setShowReplyForm(false); }}
                  className="text-xs text-slate-400 hover:text-indigo-500 transition-colors px-2 py-1">编辑</button>
                {confirmDelete ? (
                  <>
                    <button onClick={() => { onDelete(comment.nodeId); setConfirmDelete(false); }} className="text-xs text-red-500 px-2 py-1">确认删除</button>
                    <button onClick={() => setConfirmDelete(false)} className="text-xs text-slate-400 px-2 py-1">取消</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} className="text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1">删除</button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 回复表单 */}
      {showReplyForm && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          <Editor placeholder={`回复 ${comment.author.nickname}...`} submitLabel="回复"
            onSubmit={async (c) => { setBusy(true); try { await onReply(comment.nodeId, c); setShowReplyForm(false); } finally { setBusy(false); } }}
            onCancel={() => setShowReplyForm(false)} loading={busy} />
        </div>
      )}

      {/* 回复列表 */}
      {comment.replies.length > 0 && (
        <div className="mt-3">
          <button onClick={() => { setShowReplies(!showReplies); setReplyCount(2); }}
            className="text-xs text-indigo-500 hover:text-indigo-600 mb-2">
            {showReplies ? `收起回复` : `查看回复 (${comment.replies.length})`}
          </button>
          {showReplies && (
            <div className="space-y-2 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
              {comment.replies.slice(0, replyCount).map((reply) => (
                <ReplyItem key={reply.nodeId} reply={reply}
                  onReaction={onReaction} onUpvote={onUpvote} onEdit={onEdit} onDelete={onDelete} />
              ))}
              {comment.replies.length > replyCount && (
                <button onClick={() => setReplyCount(replyCount + 5)}
                  className="text-xs text-indigo-500 hover:text-indigo-600">
                  加载更多回复 ({comment.replies.length - replyCount})
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════
   主组件
   ════════════════════════════════════ */

interface CommentSectionProps { path: string }

export default function CommentSection({ path }: CommentSectionProps) {
  // 功能降级：未启用时隐藏评论区
  if (!siteConfig.featureComments) return null;

  const { user, isLoggedIn } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ListResponse | null>(null);
  const [sortBy, setSortBy] = useState<"oldest" | "newest">("newest");
  const [submitting, setSubmitting] = useState(false);

  // 游客会话
  const [guestSession] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    let s = localStorage.getItem("guestSession");
    if (!s) { s = genId(); localStorage.setItem("guestSession", s); }
    return s;
  });
  const [guestNickname, setGuestNickname] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("guestNickname") || "";
  });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await apiFetch<ListResponse>(`/comment/list?path=${encodeURIComponent(path)}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "加载评论失败"); }
    finally { setLoading(false); }
  }, [path]);

  /** 静默刷新（无 loading） */
  const refresh = useCallback(async () => {
    setError(null);
    try { setData(await apiFetch<ListResponse>(`/comment/list?path=${encodeURIComponent(path)}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "加载评论失败"); }
  }, [path]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (content: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { path, content };
      if (!isLoggedIn && guestSession) {
        if (!guestNickname.trim()) { setSubmitting(false); return; }
        body.nickname = guestNickname.trim();
      }
      const newComment = await apiFetch<CommentData>("/comment", { method: "POST", body: JSON.stringify(body) });
      if (!isLoggedIn && guestSession) {
        const ids: string[] = JSON.parse(localStorage.getItem("guestCommentIds") || "[]");
        ids.push(newComment.nodeId);
        localStorage.setItem("guestCommentIds", JSON.stringify(ids));
      }
      setData((prev) => prev ? { ...prev, comments: sortBy === "newest" ? [newComment, ...prev.comments] : [...prev.comments, newComment] } : prev);
    } finally { setSubmitting(false); }
  };

  const handleReply = async (replyToId: string, content: string) => {
    const body: Record<string, unknown> = { path, content, replyToId };
    if (!isLoggedIn && guestSession) body.nickname = guestNickname.trim();
    const newReply = await apiFetch<CommentData>("/comment", { method: "POST", body: JSON.stringify(body) });
    if (!isLoggedIn && guestSession) {
      const ids: string[] = JSON.parse(localStorage.getItem("guestCommentIds") || "[]");
      ids.push(newReply.nodeId);
      localStorage.setItem("guestCommentIds", JSON.stringify(ids));
    }
    setData((prev) => {
      if (!prev) return prev;
      const addTo = (c: CommentData) => c.nodeId === replyToId ? { ...c, replies: [...c.replies, newReply] } : c;
      return { ...prev, comments: prev.comments.map(addTo) };
    });
  };

  const handleEdit = async (nodeId: string, content: string) => {
    const oldData = data;
    setData((prev) => {
      if (!prev) return prev;
      const editNode = (c: CommentData) => c.nodeId === nodeId ? { ...c, content, lastEditedAt: new Date().toISOString() } : c;
      return {
        ...prev,
        comments: prev.comments.map((c) =>
          c.nodeId === nodeId ? editNode(c) : { ...c, replies: c.replies.map((r) => editNode(r)) }
        ),
      };
    });
    try {
      const patchBody: Record<string, string> = { content };
      if (!isLoggedIn && guestSession) patchBody.nickname = guestNickname;
      await apiFetch(`/comment/${nodeId}`, { method: "PATCH", body: JSON.stringify(patchBody) });
    } catch { setData(oldData); }
  };

  const handleDelete = async (nodeId: string) => {
    // 乐观更新（从列表中移除）
    const oldData = data;
    setData((prev) => {
      if (!prev) return prev;
      const ids = new Set([nodeId]);
      // 收集该父评论下的所有回复 ID
      for (const c of prev.comments) {
        if (c.nodeId === nodeId) c.replies.forEach((r) => ids.add(r.nodeId));
      }
      const filterTree = (c: CommentData) => ids.has(c.nodeId) ? null : { ...c, replies: c.replies.filter((r) => !ids.has(r.nodeId)) };
      return { ...prev, comments: prev.comments.map(filterTree).filter(Boolean) as CommentData[] };
    });
    try { await apiFetch(`/comment/${nodeId}`, { method: "DELETE" }); }
    catch { setData(oldData); }
  };

  const handleReaction = async (subjectId: string, reaction: string) => {
    // 乐观更新
    setData((prev) => {
      if (!prev) return prev;
      const toggle = (r: Reaction[]) => r.map((rr) =>
        rr.reaction === reaction
          ? { ...rr, count: rr.viewerHasReacted ? rr.count - 1 : rr.count + 1, viewerHasReacted: !rr.viewerHasReacted }
          : rr
      );
      return {
        ...prev,
        comments: prev.comments.map((c) =>
          c.nodeId === subjectId
            ? { ...c, reactions: toggle(c.reactions) }
            : { ...c, replies: c.replies.map((r) => r.nodeId === subjectId ? { ...r, reactions: toggle(r.reactions) } : r) }
        ),
        discussionReactions: subjectId === prev.discussionId ? toggle(prev.discussionReactions) : prev.discussionReactions,
      };
    });
    try { await apiFetch("/comment/reaction", { method: "POST", body: JSON.stringify({ subjectId, reaction }) }); } catch { refresh(); }
  };

  const handleUpvote = async (subjectId: string) => {
    // 乐观更新
    setData((prev) => {
      if (!prev) return prev;
      const toggle = (c: CommentData) => ({ ...c, upvoteCount: c.viewerHasUpvoted ? c.upvoteCount - 1 : c.upvoteCount + 1, viewerHasUpvoted: !c.viewerHasUpvoted });
      return {
        ...prev,
        comments: prev.comments.map((c) =>
          c.nodeId === subjectId ? toggle(c) : { ...c, replies: c.replies.map((r) => r.nodeId === subjectId ? toggle(r) : r) }
        ),
      };
    });
    try { await apiFetch("/comment/upvote", { method: "POST", body: JSON.stringify({ subjectId }) }); } catch { refresh(); }
  };

  const totalCount = data?.comments.reduce((s, c) => c.deletedAt ? s : s + 1 + c.replies.filter((r) => !r.deletedAt).length, 0) ?? 0;

  // 本地排序
  const sortedComments = data?.comments ? [...data.comments].sort((a, b) =>
    sortBy === "newest"
      ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  ) : [];

  return (
    <div className="w-full mt-8 relative">
      {/* 环境光晕 */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-indigo-500/10 dark:bg-indigo-500/20 blur-3xl rounded-full pointer-events-none z-0" />
      <div className="relative z-10">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black text-slate-900 dark:text-white">
          评论 <span className="text-sm font-normal text-slate-400">({totalCount})</span>
        </h3>
        {data && !loading && totalCount > 1 && (
          <div className="flex gap-1">
            <button onClick={() => setSortBy("newest")}
              className={`text-xs px-2 py-1 rounded-lg transition-colors ${sortBy === "newest" ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}>最新</button>
            <button onClick={() => setSortBy("oldest")}
              className={`text-xs px-2 py-1 rounded-lg transition-colors ${sortBy === "oldest" ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}>最早</button>
          </div>
        )}
      </div>

      {/* Discussion 反应栏 */}
      {data && data.discussionReactions && data.discussionReactions.some((r) => r.count > 0) && (
        <div className="text-center py-3">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
            反应 ({data.discussionReactions.reduce((s, r) => s + r.count, 0)})
          </h4>
          <div className="flex items-center justify-center gap-1">
            <ReactionBar
              subjectId={data.discussionId || ""}
              reactions={data.discussionReactions}
              onToggle={handleReaction}
              disabled={!isLoggedIn}
            />
          </div>
        </div>
      )}

      {/* 顶部发表框 */}
      <div className="glass-card !rounded-2xl p-5 mb-4">
        {isLoggedIn ? (
          <Editor placeholder="写下你的评论..." submitLabel="发表评论" onSubmit={handleSubmit} loading={submitting} />
        ) : guestSession ? (
          <div>
            <input
              type="text"
              value={guestNickname}
              onChange={(e) => { const v = e.target.value.slice(0, 20); setGuestNickname(v); localStorage.setItem("guestNickname", v); }}
              placeholder="输入昵称后发表评论..."
              className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none mb-3 border-b border-slate-200 dark:border-slate-700 pb-2"
              maxLength={20}
            />
            <Editor placeholder="写下你的评论..." submitLabel="发表评论" onSubmit={handleSubmit} loading={submitting} />
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-slate-400 dark:text-slate-500">
              请 <Link href="/auth/login" className="text-indigo-500 hover:underline font-bold">登录</Link> 后发表评论
            </p>
          </div>
        )}
      </div>

      {/* 加载 */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 mt-2">加载评论中...</p>
        </div>
      )}

      {/* 错误 */}
      {error && !loading && (
        <div className="glass-card !rounded-2xl p-5 text-center">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={load} className="mt-2 text-sm text-indigo-500 hover:underline">重试</button>
        </div>
      )}

      {/* 空状态 */}
      {!loading && !error && data && sortedComments.length === 0 && (
        <div className="glass-card !rounded-2xl p-8 text-center">
          <p className="text-sm text-slate-400 dark:text-slate-500">暂无评论，来写第一条吧</p>
        </div>
      )}

      {/* 评论列表 */}
      {!loading && !error && data && data.comments.length > 0 && (
        <div className="flex flex-col gap-3">
          {sortedComments.map((comment) => (
            <CommentCard key={comment.nodeId} comment={comment}
              onReply={handleReply} onEdit={handleEdit} onDelete={handleDelete}
              onReaction={handleReaction} onUpvote={handleUpvote} />
          ))}

        </div>
      )}

      </div>
    </div>
  );
}
