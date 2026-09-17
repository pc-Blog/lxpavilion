"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Dialog from "./Dialog";
import { Edit, Picture, Close } from "./icons";
import * as singerApi from "@/lib/api/singer";
import { upload as uploadMedia } from "@/lib/api/media";
import { assetUrl } from "@/lib/asset-url";
import { siteConfig } from "@/lib/siteConfig";
import type { Singer } from "@/lib/types";

interface Props {
  onClose: () => void;
}

const PAGE_SIZE = 10;

/**
 * 歌手管理弹窗。
 *
 * <p>源项目的歌手管理是独立的 Tab（SingerSearch + SingerList + SingerCard 共 1046 行），
 * 其中多图管理依赖后端不存在的 {@code /singers/{id}/pictures} 接口。
 * 此处按需求降级为与分类管理同构的「表格 + 分页 + 添加」弹窗。</p>
 *
 * <p>封面：Blog 的 {@code t_singer} 只有单张 {@code picture_url}，
 * 因此走 {@code POST /api/media/upload}（relationType=singer）拿到 fileUrl 后
 * 再随 {@code PUT /api/singer} 一起保存。删除仅清空 URL，
 * 文件本体交给管理页的孤儿扫描清理（与音乐删除同一策略）。</p>
 *
 * <p>表格样式取自 {@code index.scss} 的 {@code .el-table} 段：表头底色
 * {@code rgba(65,65,75,0.8)}、行斑马纹、悬浮转亮。</p>
 */
export default function SingerManagerDialog({ onClose }: Props) {
  const [rows, setRows] = useState<Singer[]>([]);
  const [total, setTotal] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<Singer | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await singerApi.getPage(pageNum, PAGE_SIZE);
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [pageNum]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!newName.trim()) {
      setError("请输入歌手名称");
      return;
    }
    setError("");
    try {
      await singerApi.create({ id: 0, name: newName.trim() });
      setNewName("");
      setPageNum(1);
      await load();
    } catch {
      setError("添加歌手失败");
    }
  };

  /** 上传封面：先登记到 t_media 拿到 fileUrl，再写入编辑表单 */
  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editing) return;

    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }
    // 后端上限 100MB，这里限制得更紧一些，避免误传超大图
    if (file.size > 25 * 1024 * 1024) {
      setError("图片大小不能超过 25MB");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const media = await uploadMedia(file, "singer");
      if (media?.fileUrl) {
        setEditing({ ...editing, pictureUrl: media.fileUrl });
      } else {
        setError("上传失败：未返回文件地址");
      }
    } catch {
      setError("封面上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing || !editing.name.trim()) {
      setError("歌手名称不能为空");
      return;
    }
    setError("");
    try {
      await singerApi.update(editing);
      setEditing(null);
      await load();
    } catch {
      setError("更新歌手失败");
    }
  };

  const handleDelete = async (s: Singer) => {
    setError("");
    try {
      await singerApi.remove(s.id);
      if (rows.length === 1 && pageNum > 1) setPageNum((p) => p - 1);
      else await load();
    } catch {
      setError("删除歌手失败");
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Dialog
      title={editing ? "编辑歌手" : "歌手管理"}
      onClose={onClose}
      width={640}
      footer={
        <button onClick={onClose} className="mt-btn">
          关闭
        </button>
      }
    >
      {editing ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="mt-label">歌手名称</span>
            <input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="mt-input flex-1"
            />
          </div>

          {/* 封面：单张，对应 t_singer.picture_url */}
          <div className="flex items-start gap-3">
            <span className="mt-label" style={{ paddingTop: 8 }}>
              歌手封面
            </span>
            <div className="flex items-center gap-4">
              <div className="mt-cover w-[72px] h-[72px] rounded-lg overflow-hidden">
                <img
                  src={assetUrl(editing.pictureUrl || siteConfig.defaultSingerCover)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="mt-btn mt-btn-primary"
                  >
                    {uploading ? "上传中..." : "更换封面"}
                  </button>
                  {editing.pictureUrl && (
                    <button
                      onClick={() => setEditing({ ...editing, pictureUrl: "" })}
                      className="mt-btn mt-btn-danger"
                    >
                      <Close size={12} /> 移除
                    </button>
                  )}
                </div>
                <span className="mt-hint">
                  支持 JPG / PNG / WebP，不超过 25MB
                </span>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePickImage}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setEditing(null)} className="mt-btn">
              取消
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={uploading}
              className="mt-btn mt-btn-primary"
            >
              保存
            </button>
          </div>

          {error && <div className="mt-error">{error}</div>}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* 表格 */}
          <div className="mt-table">
            <div className="mt-table-head flex items-center px-3 py-2 text-xs">
              <span className="w-12">ID</span>
              <span className="w-14 text-center">封面</span>
              <span className="flex-1">歌手名称</span>
              <span className="w-32 text-center">操作</span>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {rows.map((s) => (
                <div
                  key={s.id}
                  className="mt-table-row flex items-center px-3 py-2 text-xs"
                >
                  <span className="w-12" style={{ color: "rgba(160,180,200,0.7)" }}>
                    {s.id}
                  </span>
                  <span className="w-14 flex justify-center">
                    <span
                      className="w-8 h-8 rounded-[10%] overflow-hidden flex-shrink-0"
                      style={{
                        border: "0.5px solid rgba(120,230,255,0.2)",
                        backgroundColor: "rgba(45,45,55,0.5)",
                      }}
                    >
                      <img
                        src={assetUrl(s.pictureUrl || siteConfig.defaultSingerCover)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </span>
                  </span>
                  <span className="flex-1" style={{ color: "rgba(220,230,240,0.9)" }}>
                    {s.name}
                  </span>
                  <span className="w-32 flex justify-center gap-2">
                    <button onClick={() => setEditing(s)} className="mt-btn">
                      <Edit size={12} /> 编辑
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      className="mt-btn mt-btn-danger"
                    >
                      删除
                    </button>
                  </span>
                </div>
              ))}
              {!loading && rows.length === 0 && (
                <div className="mt-table-empty py-8 text-center text-xs">
                  暂无歌手数据
                </div>
              )}
            </div>
          </div>

          {/* 分页 */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setPageNum((p) => Math.max(1, p - 1))}
              disabled={pageNum <= 1}
              className="mt-page-nav"
            >
              上一页
            </button>
            <span className="mt-pagination-total" style={{ margin: 0 }}>
              {pageNum} / {pageCount}（共 {total} 位）
            </span>
            <button
              onClick={() => setPageNum((p) => Math.min(pageCount, p + 1))}
              disabled={pageNum >= pageCount}
              className="mt-page-nav"
            >
              下一页
            </button>
          </div>

          {/* 添加表单 */}
          <div
            className="flex items-center gap-3 pt-4"
            style={{ borderTop: "0.5px solid rgba(120,230,255,0.15)" }}
          >
            <span className="mt-label">歌手名称</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="请输入歌手名称"
              className="mt-input flex-1"
            />
            <button onClick={handleAdd} className="mt-btn mt-btn-primary">
              添加
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Picture size={13} className="mt-input-icon" />
            <span className="mt-hint">
              新增后点「编辑」可设置封面；未设置的歌手展示默认图
            </span>
          </div>

          {error && <div className="mt-error">{error}</div>}
        </div>
      )}
    </Dialog>
  );
}
