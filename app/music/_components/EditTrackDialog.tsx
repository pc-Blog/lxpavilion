"use client";

import { useState } from "react";
import Dialog from "./Dialog";
import Select from "./Select";
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
 * <p>后端不接受 fileUrl / duration / playCount 的修改，因此只提交业务字段。</p>
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
              <span className="mt-confirm-text self-center mr-auto">
                确定要删除该歌曲吗？
              </span>
              <button onClick={() => setConfirmDelete(false)} className="mt-btn">
                取消
              </button>
              <button onClick={doDelete} disabled={busy} className="mt-btn mt-btn-danger">
                确定删除
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setConfirmDelete(true)}
                className="mt-btn mt-btn-danger mr-auto"
              >
                删除
              </button>
              <button onClick={onClose} className="mt-btn">
                取消
              </button>
              <button onClick={submit} disabled={busy} className="mt-btn mt-btn-primary">
                {busy ? "保存中..." : "确认"}
              </button>
            </>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="mt-label">歌曲名称</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-input flex-1"
          />
        </div>

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
          <span className="mt-label">播放次数</span>
          <span className="text-sm" style={{ color: "rgba(180,200,220,0.8)" }}>
            {music.playCount ?? 0}
          </span>
        </div>

        {error && <div className="mt-error">{error}</div>}
      </div>
    </Dialog>
  );
}
