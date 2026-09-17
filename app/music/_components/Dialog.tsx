"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { Close } from "./icons";

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
 * <p>对应源项目 Element Plus 的 {@code .el-dialog}（见 {@code index.scss}）：
 * {@code rgba(55,55,65,0.75)} + {@code blur(22px) brightness(0.96)} + 10px 圆角，
 * 悬浮时上移 1px 并加强辉光；标题带霓虹文字阴影。</p>
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
      style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mt-panel flex flex-col max-h-[85vh] overflow-hidden"
        style={{ width, maxWidth: "100%" }}
      >
        <div className="mt-panel-header flex items-center justify-between px-5 py-4">
          <h3 className="mt-panel-title m-0 text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="mt-btn mt-btn-circle" aria-label="关闭">
            <Close size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {footer && (
          <div className="mt-panel-footer flex justify-end gap-3 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
