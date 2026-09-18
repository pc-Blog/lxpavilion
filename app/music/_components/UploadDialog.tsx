"use client";

import { useRef, useState } from "react";
import Dialog from "./Dialog";
import Select from "./Select";
import { Close } from "./icons";
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
          <button onClick={onClose} className="mt-btn">
            取消
          </button>
          <button onClick={submit} disabled={busy} className="mt-btn mt-btn-primary">
            {busy ? "上传中..." : "上传"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="mt-label">歌手</span>
          <Select
            className="flex-1"
            placeholder="请选择歌手"
            ariaLabel="歌手"
            clearable
            value={singerId === null ? "" : String(singerId)}
            options={singers.map((s) => ({ value: String(s.id), label: s.name }))}
            onChange={(v) => setSingerId(v === "" ? null : Number(v))}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="mt-label">分类</span>
          <Select
            className="flex-1"
            placeholder="请选择分类"
            ariaLabel="分类"
            clearable
            value={categoryId === null ? "" : String(categoryId)}
            options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
            onChange={(v) => setCategoryId(v === "" ? null : Number(v))}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="mt-label">音乐文件</span>
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
          <button onClick={() => inputRef.current?.click()} className="mt-btn mt-btn-primary">
            选择文件
          </button>
          <span className="mt-hint">支持批量上传音频文件</span>
        </div>

        {files.length > 0 && (
          <div className="mt-table">
            {/* 文件列表表头 */}
            <div className="mt-table-head flex px-3 py-2 text-xs">
              <span className="flex-1">文件名</span>
              <span className="w-20 text-right">大小</span>
              <span className="w-10 text-center">操作</span>
            </div>
            <div className="max-h-[240px] overflow-y-auto">
              {files.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="mt-table-row flex items-center px-3 py-2 text-xs"
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
                      className="mt-btn mt-btn-danger"
                      style={{ padding: 3 }}
                      aria-label="移除"
                    >
                      <Close size={12} />
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

        {error && <div className="mt-error">{error}</div>}
      </div>
    </Dialog>
  );
}
