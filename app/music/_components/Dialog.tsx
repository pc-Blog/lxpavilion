"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

/**
 * 弹窗外壳。
 *
 * <p>统一源项目 Element Plus 弹窗的深色玻璃风格
 * （{@code rgba(60,60,70,0.95)} + blur + 青色霓虹描边），
 * 供上传 / 编辑 / 歌手管理 / 分类管理共用。</p>
 */
export default function Dialog({ title, onClose, children, footer, width = 600 }: Props) {
  // Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(10,10,20,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col max-h-[85vh] rounded-lg overflow-hidden"
        style={{
          width,
          maxWidth: "100%",
          backgroundColor: "rgba(60,60,70,0.95)",
          backdropFilter: "blur(18px) brightness(0.96)",
          border: "0.5px solid rgba(120,230,255,0.25)",
          boxShadow:
            "0 0 24px rgba(120,230,255,0.15), inset 0 0 12px rgba(120,230,255,0.06)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "0.5px solid rgba(120,230,255,0.15)" }}
        >
          <h3
            className="m-0 text-base font-semibold"
            style={{ color: "rgba(220,240,255,0.9)" }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded transition-colors duration-200"
            style={{ color: "rgba(180,200,220,0.8)" }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {footer && (
          <div
            className="flex justify-end gap-3 px-5 py-4"
            style={{ borderTop: "0.5px solid rgba(120,230,255,0.15)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** 统一的输入框样式，供各弹窗复用 */
export const inputStyle: React.CSSProperties = {
  backgroundColor: "rgba(65,65,75,0.7)",
  border: "1px solid rgba(120,230,255,0.2)",
  color: "rgba(220,230,240,0.9)",
  borderRadius: 6,
  height: 38,
  padding: "0 10px",
  fontSize: 13,
  outline: "none",
  width: "100%",
};

export const labelStyle: React.CSSProperties = {
  color: "rgba(200,220,240,0.9)",
  fontSize: 13,
  width: 70,
  flexShrink: 0,
};

export const primaryBtnStyle: React.CSSProperties = {
  backgroundColor: "rgba(70,165,255,0.8)",
  border: "1px solid rgba(120,230,255,0.3)",
  color: "#fff",
  borderRadius: 6,
  height: 36,
  padding: "0 18px",
  fontSize: 13,
};

export const ghostBtnStyle: React.CSSProperties = {
  backgroundColor: "rgba(70,70,80,0.6)",
  border: "1px solid rgba(120,120,140,0.3)",
  color: "rgba(220,230,240,0.9)",
  borderRadius: 6,
  height: 36,
  padding: "0 18px",
  fontSize: 13,
};
