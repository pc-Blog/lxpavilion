"use client";

import { useState, useCallback, useEffect, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import { assetUrl } from "@/lib/asset-url";

/* ── 代码块（含复制按钮） ── */
function PreBlock({ children, ...props }: React.ComponentPropsWithoutRef<"pre">) {
  const [copied, setCopied] = useState(false);
  const codeText = extractText(children);

  const copy = useCallback(() => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(codeText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    } else {
      // fallback: 非安全上下文（自定义域名 HTTP）下 clipboard API 不可用
      const ta = document.createElement("textarea");
      ta.value = codeText;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [codeText]);

  return (
    <div className="relative group my-4">
      <pre {...props}>
        <button
          onClick={copy}
          className="absolute top-2 right-2 z-10 px-2 py-1 text-[11px] rounded-md
                     bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white
                     transition-all duration-200 opacity-0 group-hover:opacity-100"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        {children}
      </pre>
    </div>
  );
}

function extractText(node: ReactNode): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    const { children } = node.props as { children?: ReactNode };
    return extractText(children);
  }
  return "";
}

/* ── Lightbox 全局遮罩 ── */
function LightboxOverlay({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-sm"
      onClick={onClose}
    >
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 text-white
                   hover:bg-white/25 transition-all flex items-center justify-center text-xl"
      >
        ✕
      </button>
    </div>
  );
}

import Portal from "@/app/_components/common/Portal";

export default function ArticleProse({ content }: { content: string }) {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  const openLightbox = useCallback((src: string, alt: string) => {
    setLightbox({ src, alt });
  }, []);

  const closeLightbox = useCallback(() => {
    setLightbox(null);
  }, []);

  /* ── 自定义组件映射（使用闭包中的 openLightbox） ── */
  const components: Components = {
    pre: PreBlock,
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    ),
    img({ src, alt, ...props }) {
      const resolvedSrc = typeof src === "string" ? assetUrl(src) : src;
      return (
        <img
          src={resolvedSrc}
          alt={alt ?? ""}
          loading="lazy"
          onClick={() => resolvedSrc && typeof resolvedSrc === "string" && openLightbox(resolvedSrc, alt ?? "")}
          className="cursor-zoom-in transition-transform duration-300 hover:scale-[1.02]"
          {...props}
        />
      );
    },
  };

  return (
    <>
      <div id="article-content" className="article-prose">
        <style>{`
          .article-prose { color: #334155; line-height: 1.85; word-break: break-word; }
          .dark .article-prose { color: #cbd5e1; }
          .article-prose h1 { font-size: 1.8rem; font-weight: 950; margin: 2.5rem 0 1.2rem; letter-spacing: -0.03em; line-height: 1.25; }
          .article-prose h2 { font-size: 1.5rem; font-weight: 800; margin: 2.2rem 0 0.8rem; letter-spacing: -0.02em; padding-bottom: 0.5rem; border-bottom: 2px solid rgba(99,102,241,0.2); }
          .article-prose h3 { font-size: 1.2rem; font-weight: 700; margin: 1.8rem 0 0.6rem; }
          .article-prose h4 { font-size: 1.05rem; font-weight: 700; margin: 1.5rem 0 0.5rem; }
          .article-prose p { margin: 0.8rem 0; font-size: 0.95rem; }
          .article-prose a { color: #6366f1; text-decoration: underline; text-decoration-style: dashed; text-underline-offset: 3px; font-weight: 600; }
          .article-prose a:hover { text-decoration: solid; background: rgba(99,102,241,0.08); padding: 0.1rem 0.2rem; border-radius: 0.2rem; }
          .dark .article-prose a { color: #a5b4fc; }
          .article-prose ul { list-style: disc; padding-left: 1.5rem; margin: 0.8rem 0; }
          .article-prose ol { list-style: decimal; padding-left: 1.5rem; margin: 0.8rem 0; }
          .article-prose li { margin: 0.3rem 0; font-size: 0.95rem; }
          .article-prose blockquote { margin: 1.2rem 0; padding: 0.8rem 1.2rem; border-left: 4px solid #6366f1; background: rgba(99,102,241,0.05); border-radius: 0 1.25rem 1.25rem 0; font-style: italic; color: #64748b; }
          .dark .article-prose blockquote { border-color: #818cf8; background: rgba(129,140,248,0.1); color: #94a3b8; }
          .article-prose blockquote p { margin: 0; }
          .article-prose img { display: block; max-width: 100%; height: auto; margin: 1.5rem auto; border-radius: 1.5rem; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
          .dark .article-prose img { box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
          .article-prose pre { background: #282c34 !important; color: #abb2bf; padding: 1.25rem; border-radius: 0.75rem; overflow-x: auto; margin: 0; box-shadow: inset 0 0 10px rgba(0,0,0,0.3); font-size: 0.85rem; line-height: 1.7; }
          .article-prose code { font-family: "JetBrains Mono","Fira Code","Cascadia Code","Source Code Pro",Menlo,Consolas,ui-monospace,monospace; }
          .article-prose :not(pre) > code { background: rgba(99,102,241,0.1); color: #6366f1; padding: 0.1rem 0.35rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.85em; }
          .dark .article-prose :not(pre) > code { background: rgba(129,140,248,0.2); color: #818cf8; }
          .article-prose pre code { background: transparent !important; color: inherit; padding: 0; font-weight: 400; }
          .article-prose hr { border: none; border-top: 1px solid rgba(99,102,241,0.15); margin: 2rem 0; }
          .article-prose table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.9rem; }
          .article-prose th { background: rgba(99,102,241,0.1); color: #6366f1; font-weight: 700; padding: 0.6rem 0.8rem; text-align: left; border-bottom: 2px solid rgba(99,102,241,0.2); }
          .article-prose td { padding: 0.5rem 0.8rem; border-bottom: 1px solid rgba(0,0,0,0.06); }
          .dark .article-prose td { border-color: rgba(255,255,255,0.06); }
          .article-prose del, .article-prose s { opacity: 0.6; }
          .article-prose strong { font-weight: 800; color: inherit; }
          .article-prose input[type="checkbox"] { margin-right: 0.4rem; }

          .article-prose .hljs-comment,.article-prose .hljs-quote { color: #5c6370; font-style: italic; }
          .article-prose .hljs-doctag,.article-prose .hljs-keyword,.article-prose .hljs-formula { color: #c678dd; }
          .article-prose .hljs-section,.article-prose .hljs-name,.article-prose .hljs-selector-tag,.article-prose .hljs-deletion,.article-prose .hljs-subst { color: #e06c75; }
          .article-prose .hljs-literal { color: #56b6c2; }
          .article-prose .hljs-string,.article-prose .hljs-regexp,.article-prose .hljs-addition,.article-prose .hljs-attribute,.article-prose .hljs-meta .hljs-string { color: #98c379; }
          .article-prose .hljs-attr,.article-prose .hljs-variable,.article-prose .hljs-template-variable,.article-prose .hljs-type,.article-prose .hljs-selector-class,.article-prose .hljs-selector-attr,.article-prose .hljs-selector-pseudo,.article-prose .hljs-number { color: #d19a66; }
          .article-prose .hljs-symbol,.article-prose .hljs-bullet,.article-prose .hljs-link,.article-prose .hljs-meta,.article-prose .hljs-selector-id,.article-prose .hljs-title { color: #61aeee; }
          .article-prose .hljs-built_in,.article-prose .hljs-title.class_,.article-prose .hljs-class .hljs-title { color: #e6c07b; }
          .article-prose .hljs-emphasis { font-style: italic; }
          .article-prose .hljs-strong { font-weight: bold; }
          @media (min-width: 768px) {
            .article-prose h1 { font-size: 2.2rem; }
            .article-prose h2 { font-size: 1.7rem; }
            .article-prose p,.article-prose li { font-size: 1.05rem; }
            .article-prose img { border-radius: 2rem; box-shadow: 0 20px 50px rgba(0,0,0,0.12); }
            .article-prose pre { padding: 1.5rem; }
            .article-prose ul,.article-prose ol { padding-left: 2rem; }
          }
        `}</style>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </div>

      {/* Lightbox overlay — 在 article-prose 外部渲染，确保全局遮罩 */}
      {lightbox && (
        <Portal>
          <LightboxOverlay src={lightbox.src} alt={lightbox.alt} onClose={closeLightbox} />
        </Portal>
      )}
    </>
  );
}
