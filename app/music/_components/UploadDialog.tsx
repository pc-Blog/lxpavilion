"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import Dialog, { ghostBtnStyle, inputStyle, labelStyle, primaryBtnStyle } from "./Dialog";
import * as musicApi from "@/lib/api/music";
import type { Singer, MusicCategory } from "@/lib/types";

interface Props {
  singers: Singer[];
  categories: MusicCategory[];
  onClose: () => void;
  onDone: () => void;
}

function formatSize(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatName(name: string) {
  return name.length > 30
    ? `${name.substring(0, 15)}...${name.substring(name.length - 10)}`
    : name;
}

/**
 * 批量上传歌曲弹窗。
 *
 * <p>复刻源项目 {@code SongHead.vue} 的「批量添加歌曲」对话框：选歌手 / 分类，
 * 多选音频文件，逐条列出文件名与大小并显示总计。</p>
 *
 * <p>与源项目的差异：歌手 / 分类改传 id（后端接口签名为 singerId / categoryId），
 * 而非源项目的名称字符串。</p>
 */
export default function UploadDialog({ singers, categories, onClose, onDone }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [singerId, setSingerId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  const addFiles = (picked: FileList | null) => {
    if (!picked) return;
    setFiles((prev) => {
      const next = [...prev];
      Array.from(picked).forEach((f) => {
        if (!next.some((x) => x.name === f.name)) next.push(f);
      });
      return next;
    });
  };

  const submit = async () => {
    if (files.length === 0) {
      setError("请至少选择一个音乐文件");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await musicApi.upload(files, singerId, categoryId);
      onDone();
    } catch {
      setError("批量上传失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="批量添加歌曲"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} style={ghostBtnStyle}>
            取消
          </button>
          <button
            onClick={submit}
            disabled={busy}
            style={{ ...primaryBtnStyle, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "上传中..." : "上传"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span style={labelStyle}>歌手</span>
          <select
            value={singerId ?? ""}
            onChange={(e) =>
              setSingerId(e.target.value === "" ? null : Number(e.target.value))
            }
            style={inputStyle}
          >
            <option value="">请选择歌手</option>
            {singers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span style={labelStyle}>分类</span>
          <select
            value={categoryId ?? ""}
            onChange={(e) =>
              setCategoryId(e.target.value === "" ? null : Number(e.target.value))
            }
            style={inputStyle}
          >
            <option value="">请选择分类</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span style={labelStyle}>音乐文件</span>
          <input
            ref={inputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button onClick={() => inputRef.current?.click()} style={primaryBtnStyle}>
            选择文件
          </button>
          <span className="text-xs" style={{ color: "rgba(160,180,200,0.7)" }}>
            支持批量上传音频文件
          </span>
        </div>

        {files.length > 0 && (
          <div
            className="rounded overflow-hidden"
            style={{
              border: "0.5px solid rgba(120,230,255,0.2)",
              backgroundColor: "rgba(65,65,75,0.6)",
            }}
          >
            <div
              className="flex px-3 py-2 text-xs font-medium"
              style={{
                backgroundColor: "rgba(70,70,80,0.7)",
                color: "rgba(180,220,255,0.9)",
                borderBottom: "0.5px solid rgba(120,230,255,0.15)",
              }}
            >
              <span className="flex-1">文件名</span>
              <span className="w-20 text-right">大小</span>
              <span className="w-10 text-center">操作</span>
            </div>
            <div className="max-h-[240px] overflow-y-auto">
              {files.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="flex items-center px-3 py-2 text-xs"
                  style={{ borderBottom: "0.5px solid rgba(120,230,255,0.08)" }}
                >
                  <span
                    className="flex-1 truncate pr-3"
                    title={f.name}
                    style={{ color: "rgba(220,230,240,0.9)" }}
                  >
                    {formatName(f.name)}
                  </span>
                  <span
                    className="w-20 text-right pr-3"
                    style={{ color: "rgba(180,200,220,0.8)" }}
                  >
                    {formatSize(f.size)}
                  </span>
                  <span className="w-10 flex justify-center">
                    <button
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      style={{ color: "rgba(255,120,120,0.9)" }}
                    >
                      <X size={14} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
            <div
              className="px-3 py-2 text-center text-xs"
              style={{
                backgroundColor: "rgba(70,70,80,0.7)",
                color: "rgba(180,200,220,0.8)",
                borderTop: "0.5px solid rgba(120,230,255,0.1)",
              }}
            >
              共 {files.length} 个文件，总计 {formatSize(totalSize)}
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs" style={{ color: "rgba(255,120,120,0.9)" }}>
            {error}
          </div>
        )}
      </div>
    </Dialog>
  );
}
