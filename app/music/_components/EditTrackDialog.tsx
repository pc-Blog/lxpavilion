"use client";

import { useState } from "react";
import Dialog, { ghostBtnStyle, inputStyle, labelStyle, primaryBtnStyle } from "./Dialog";
import * as musicApi from "@/lib/api/music";
import type { Music, Singer, MusicCategory } from "@/lib/types";

interface Props {
  music: Music;
  singers: Singer[];
  categories: MusicCategory[];
  onClose: () => void;
  onDone: () => void;
}

/**
 * 编辑单曲弹窗。
 *
 * <p>复刻源项目 {@code SongCard.vue} 的「编辑歌曲信息」对话框：歌曲名称、
 * 歌手、分类可改，播放次数只读。</p>
 *
 * <p>与源项目的差异：源项目的删除按钮放在编辑弹窗内，此处保留；
 * 但后端不接受 fileUrl / duration / playCount 的修改，因此只提交业务字段。</p>
 */
export default function EditTrackDialog({
  music,
  singers,
  categories,
  onClose,
  onDone,
}: Props) {
  const [title, setTitle] = useState(music.title);
  const [singerId, setSingerId] = useState<number | null>(music.singerId ?? null);
  const [categoryId, setCategoryId] = useState<number | null>(music.categoryId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      setError("歌曲名称不能为空");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await musicApi.update({ ...music, title, singerId, categoryId });
      onDone();
    } catch {
      setError("更新歌曲失败");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    setError("");
    try {
      await musicApi.remove(music.id);
      onDone();
    } catch {
      setError("删除歌曲失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="编辑歌曲信息"
      onClose={onClose}
      width={500}
      footer={
        <>
          {confirmDelete ? (
            <>
              <span
                className="mr-auto text-xs self-center"
                style={{ color: "rgba(255,150,150,0.9)" }}
              >
                确定要删除该歌曲吗？
              </span>
              <button onClick={() => setConfirmDelete(false)} style={ghostBtnStyle}>
                取消
              </button>
              <button
                onClick={doDelete}
                disabled={busy}
                style={{
                  ...primaryBtnStyle,
                  backgroundColor: "rgba(200,80,80,0.85)",
                  borderColor: "rgba(255,120,120,0.4)",
                }}
              >
                确定删除
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setConfirmDelete(true)}
                className="mr-auto"
                style={{
                  ...ghostBtnStyle,
                  backgroundColor: "rgba(180,70,70,0.6)",
                  borderColor: "rgba(255,120,120,0.3)",
                  color: "rgba(255,200,200,0.95)",
                }}
              >
                删除
              </button>
              <button onClick={onClose} style={ghostBtnStyle}>
                取消
              </button>
              <button
                onClick={submit}
                disabled={busy}
                style={{ ...primaryBtnStyle, opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "保存中..." : "确认"}
              </button>
            </>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span style={labelStyle}>歌曲名称</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
          />
        </div>

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
          <span style={labelStyle}>播放次数</span>
          <span className="text-sm" style={{ color: "rgba(180,200,220,0.8)" }}>
            {music.playCount ?? 0}
          </span>
        </div>

        {error && (
          <div className="text-xs" style={{ color: "rgba(255,120,120,0.9)" }}>
            {error}
          </div>
        )}
      </div>
    </Dialog>
  );
}
